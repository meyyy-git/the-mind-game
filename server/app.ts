import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { Server, type Socket } from 'socket.io';
import { act, connect, disconnect, newRoom, requireThat, syncPresence, tick, validateName, view } from './game';
import { Store } from './store';
import type { Action, Reply } from '../shared/types';

export function createApp(options: { database?: string; dist?: string; origin?: string; maxRooms?: number; maxSpectators?: number; heartbeat?: number } = {}) {
  const store = new Store(options.database ?? 'data/game.sqlite');
  const root = resolve(options.dist ?? 'dist');
  let healthy = true;
  const http = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self'; frame-ancestors 'none'");
      if (pathname === '/health') { res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: healthy })); return; }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      const path = resolve(root, '.' + decodeURIComponent(pathname));
      if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403); res.end(); return; }
      let file = Bun.file(path);
      if (path === root || !await file.exists()) {
        if (pathname === '/' || /^\/room\/[A-Z0-9]{6}\/?$/i.test(pathname)) file = Bun.file(resolve(root, 'index.html'));
        else { res.writeHead(404); res.end(); return; }
      }
      if (!await file.exists()) { res.writeHead(503); res.end('Run bun run build first.'); return; }
      res.setHeader('Content-Type', file.type);
      res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
      res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : Buffer.from(await file.arrayBuffer()));
    } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
  });
  const rate = new Map<string, { count: number; until: number }>();
  function allowed(key: string, max: number, ms: number) {
    const now = Date.now(); const bucket = rate.get(key);
    if (!bucket || bucket.until <= now) { rate.set(key, { count: 1, until: now + ms }); return true; }
    return ++bucket.count <= max;
  }
  const io = new Server(http, {
    maxHttpBufferSize: 8192, pingInterval: 10_000, pingTimeout: 10_000,
    allowRequest(req, cb) {
      const origin = req.headers.origin;
      const expected = options.origin;
      let valid = !origin;
      try { valid ||= expected ? origin === expected : new URL(origin!).host === req.headers.host || /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin!); } catch { /* invalid origin */ }
      cb(null, valid && allowed('connection:' + req.socket.remoteAddress, 120, 60_000));
    },
  });
  const sockets = new Map<string, Socket>();
  const key = (code: string, id: string) => `${code}:${id}`;
  function broadcast(code: string) {
    const room = store.rooms.get(code); if (!room) return;
    for (const m of room.members) sockets.get(key(code, m.id))?.emit('state', view(room, m.id));
  }
  function errorCode(error: unknown) {
    const code = error instanceof Error ? error.message : '';
    const known = ['name', 'nameTaken', 'expired', 'missing', 'full', 'session', 'invalid', 'settings', 'stale', 'phase', 'card', 'hostOnly', 'playerOnly', 'notReady', 'rate', 'capacity'];
    if (known.includes(code)) return code;
    healthy = false; console.error('Room persistence failed; restart required after checking storage.');
    return 'storage';
  }
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return next(new Error('session'));
    socket.data.secret = createHash('sha256').update(token).digest('hex'); next();
  });
  io.on('connection', socket => {
    socket.on('enter', (input: unknown, ack: (reply: Reply<{ code: string }>) => void) => {
      if (typeof ack !== 'function') return;
      try {
        requireThat(healthy, 'storage');
        requireThat(allowed('enter:' + socket.handshake.address, 40, 60_000), 'rate');
        requireThat(input && typeof input === 'object', 'invalid');
        const data = input as { create?: boolean; code?: string; name?: unknown };
        requireThat(!socket.data.code, 'session');
        let code: string, id: string;
        if (data.create === true) {
          requireThat(allowed('create:' + socket.handshake.address, 8, 60_000), 'rate');
          requireThat(store.rooms.size < (options.maxRooms ?? 100), 'capacity');
          validateName(data.name);
          do { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (store.rooms.has(code));
          const room = newRoom(code); id = connect(room, socket.data.secret, data.name); room.revision++;
          store.save(room);
        } else {
          requireThat(typeof data.code === 'string' && /^[A-Z0-9]{6}$/i.test(data.code), 'missing');
          code = data.code.toUpperCase();
          id = store.change(code, room => connect(room, socket.data.secret, data.name, Date.now(), options.maxSpectators ?? 12));
        }
        socket.data.code = code; socket.data.member = id;
        const old = sockets.get(key(code, id)); sockets.set(key(code, id), socket);
        if (old && old !== socket) { old.emit('fatal', 'replaced'); old.disconnect(true); }
        ack({ ok: true, data: { code } }); broadcast(code);
      } catch (error) { ack({ ok: false, error: errorCode(error) }); }
    });
    socket.on('action', (input: Action, ack: (reply: Reply) => void) => {
      if (typeof ack !== 'function') return;
      try {
        requireThat(healthy, 'storage');
        requireThat(allowed('action:' + socket.id, 60, 5_000), 'rate');
        const { code, member } = socket.data;
        requireThat(code && member && sockets.get(key(code, member)) === socket, 'session');
        requireThat(input && typeof input === 'object', 'invalid');
        store.change(code, room => {
          requireThat(!room.expiresAt || room.expiresAt > Date.now(), 'expired');
          tick(room, Date.now()); act(room, member, input);
        });
        ack({ ok: true, data: undefined });
        const room = store.rooms.get(code)!;
        for (const [entry, participant] of sockets) {
          if (participant.data.code === code && !room.members.some(m => m.id === participant.data.member)) {
            sockets.delete(entry); participant.emit('fatal', input.type === 'leave' ? 'left' : 'kicked'); participant.disconnect(true);
          }
        }
        broadcast(code);
      } catch (error) { ack({ ok: false, error: errorCode(error) }); if (socket.data.code) broadcast(socket.data.code); }
    });
    socket.on('disconnect', () => {
      const { code, member } = socket.data;
      if (!code || sockets.get(key(code, member)) !== socket) return;
      sockets.delete(key(code, member));
      if (!healthy || !store.rooms.has(code)) return;
      try { store.change(code, room => disconnect(room, member)); broadcast(code); }
      catch (error) { errorCode(error); }
    });
  });
  let lastHeartbeat = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rate) if (v.until <= now) rate.delete(k);
    if (!healthy) return;
    try {
      for (const [code, room] of store.rooms) {
        if (room.expiresAt && room.expiresAt <= now) {
          store.delete(code);
          for (const [k, socket] of sockets) if (socket.data.code === code) { sockets.delete(k); socket.emit('fatal', 'expired'); socket.disconnect(true); }
          continue;
        }
        const draft = structuredClone(room); tick(draft, now);
        const changed = draft.epoch !== room.epoch;
        if (now - lastHeartbeat >= (options.heartbeat ?? 15_000)) syncPresence(draft, now);
        if (changed || draft.lastSeen !== room.lastSeen) { draft.revision++; store.save(draft); if (changed) broadcast(code); }
      }
      if (now - lastHeartbeat >= (options.heartbeat ?? 15_000)) lastHeartbeat = now;
    } catch (error) { errorCode(error); }
  }, 1000);
  return {
    http, store, io,
    async listen(port = 3000, hostname = '0.0.0.0') {
      await new Promise<void>(resolve => http.listen(port, hostname, resolve));
      return (http.address() as { port: number }).port;
    },
    async close() {
      clearInterval(timer);
      await new Promise<void>(resolve => io.close(() => resolve()));
      store.close();
    },
  };
}
