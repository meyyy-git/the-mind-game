import { randomInt, randomUUID } from 'node:crypto';
import type { Action, Member, Phase, Reason, Room, RoomView, Settings } from '../shared/types';

export const DAY = 86_400_000;
export function requireThat(condition: unknown, code: string): asserts condition { if (!condition) throw new Error(code); }
export function validateName(value: unknown) {
  requireThat(typeof value === 'string', 'name');
  const name = value.normalize('NFKC').trim();
  requireThat(/^[\p{L}\p{N} _.-]{1,24}$/u.test(name), 'name');
  return name;
}
export function validateSettings(value: unknown): Settings {
  const s = value as Settings;
  requireThat(s && ['pause', 'continue'].includes(s.disconnect) && [30, 60, 120].includes(s.timeout), 'settings');
  return { disconnect: s.disconnect, timeout: s.timeout };
}
export function players(r: Room) { return r.members.filter(m => m.role === 'player'); }
export function transition(r: Room, phase: Phase, reason: Reason = r.reason) {
  r.phase = phase; r.reason = reason; r.epoch++;
  for (const m of r.members) m.ready = false;
}
export function newRoom(code: string, now = Date.now()): Room {
  return { code, host: '', members: [], settings: { disconnect: 'pause', timeout: 60 }, phase: 'lobby', reason: 'welcome', epoch: 0, revision: 0, gameId: '', level: 0, target: 0, lives: 0, stars: 0, top: null, votes: [], revealed: [], expiresAt: now + DAY, lastSeen: now, receipts: [], event: { id: randomUUID(), kind: 'welcome' } };
}
export function event(r: Room, kind: string) { r.event = { id: randomUUID(), kind }; }
export function syncPresence(r: Room, now: number) {
  const online = players(r).filter(m => m.online);
  if (online.length) { r.lastSeen = now; r.expiresAt = null; }
  else r.expiresAt ??= now + DAY;
  if (!online.some(m => m.id === r.host)) r.host = online.sort((a, b) => a.joined - b.joined)[0]?.id ?? '';
}
export function connect(r: Room, secret: string, rawName: unknown, now = Date.now(), maxSpectators = 12) {
  requireThat(!r.expiresAt || r.expiresAt > now, 'expired');
  let member = r.members.find(m => m.secret === secret);
  if (member) {
    const wasOffline = !member.online;
    member.online = true; member.deadline = null;
    if (wasOffline && member.role === 'player') {
      if (r.phase === 'active' || r.phase === 'ready') transition(r, 'ready', 'reconnect');
      if (r.phase === 'paused' && players(r).every(m => m.online)) transition(r, 'ready', 'reconnect');
    }
  } else {
    const name = validateName(rawName);
    requireThat(!r.members.some(m => m.name.toLowerCase() === name.toLowerCase()), 'nameTaken');
    const role = r.phase === 'lobby' && players(r).length < 4 ? 'player' : 'spectator';
    requireThat(role === 'player' || r.members.filter(m => m.role === 'spectator').length < maxSpectators, 'full');
    member = { id: randomUUID(), name, secret, role, online: true, ready: false, joined: now, hand: [], deadline: null };
    r.members.push(member);
    if (role === 'player') transition(r, 'lobby', 'welcome');
  }
  syncPresence(r, now);
  return member.id;
}
export function disconnect(r: Room, id: string, now = Date.now()) {
  const m = r.members.find(m => m.id === id);
  if (!m) return;
  m.online = false; m.ready = false;
  if (m.role === 'player') {
    m.deadline = now + r.settings.timeout * 1000;
    if (r.phase === 'active' && r.settings.disconnect === 'pause' || r.phase === 'ready') transition(r, 'paused', 'disconnect');
    if (r.phase === 'vote') r.votes = r.votes.filter(v => v !== id);
    if (r.phase === 'lobby') transition(r, 'lobby', r.reason);
    if (!players(r).some(p => p.online) && r.phase === 'active') transition(r, 'paused', 'disconnect');
  }
  syncPresence(r, now);
}
export function tick(r: Room, now: number) {
  if (r.phase === 'active' && players(r).some(m => !m.online && m.deadline !== null && m.deadline <= now)) transition(r, 'paused', 'disconnect');
}
export function recover(r: Room, now = Date.now()) {
  r.expiresAt ??= r.lastSeen + DAY;
  for (const m of r.members) { m.online = false; m.ready = false; m.deadline = null; }
  r.host = '';
  if (r.phase === 'vote') { r.votes = []; r.epoch++; }
  else if (['active', 'ready', 'paused'].includes(r.phase)) transition(r, 'paused', 'restart');
  r.revision++;
  return !r.expiresAt || r.expiresAt > now;
}
function deal(r: Room) {
  const deck = Array.from({ length: 100 }, (_, i) => i + 1);
  for (let i = deck.length - 1; i > 0; i--) { const j = randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  for (const m of players(r)) m.hand = deck.splice(0, r.level).sort((a, b) => a - b);
  r.top = null; r.revealed = []; r.votes = [];
  transition(r, 'ready', 'level'); event(r, 'level');
}
function finishLevel(r: Room) {
  if (r.lives <= 0) { transition(r, 'finished', 'lost'); event(r, 'lost'); return; }
  if (players(r).some(m => m.hand.length)) return;
  if ([2, 5, 8].includes(r.level)) r.stars = Math.min(3, r.stars + 1);
  if ([3, 6, 9].includes(r.level)) r.lives = Math.min(5, r.lives + 1);
  if (r.level === r.target) { transition(r, 'finished', 'won'); event(r, 'won'); }
  else { r.level++; deal(r); }
}
function lobby(r: Room, reason: Reason) {
  transition(r, 'lobby', reason); r.gameId = ''; r.level = 0; r.target = 0; r.top = null; r.votes = []; r.revealed = [];
  for (const m of r.members) { m.hand = []; m.deadline = null; }
}
export function act(r: Room, memberId: string, a: Action, now = Date.now()) {
  requireThat(a && typeof a.id === 'string' && /^[a-f\d-]{36}$/i.test(a.id), 'invalid');
  const m = r.members.find(m => m.id === memberId);
  requireThat(m?.online, 'session');
  const receipt = memberId + ':' + a.id;
  if (r.receipts.includes(receipt)) return false;
  requireThat(a.epoch === r.epoch && a.gameId === r.gameId, 'stale');
  const isHost = () => requireThat(r.host === memberId, 'hostOnly');
  const isPlayer = () => requireThat(m.role === 'player', 'playerOnly');
  switch (a.type) {
    case 'settings':
      isHost(); requireThat(r.phase === 'lobby', 'phase'); r.settings = validateSettings(a.settings); transition(r, 'lobby'); break;
    case 'ready':
      isPlayer(); requireThat(r.phase === 'lobby' || r.phase === 'ready', 'phase'); m.ready = true;
      if (r.phase === 'ready' && players(r).filter(m => m.online).every(m => m.ready)) {
        transition(r, 'active'); r.revealed = []; event(r, 'active');
      }
      break;
    case 'start':
      isHost(); requireThat(r.phase === 'lobby', 'phase');
      requireThat(players(r).length >= 2 && players(r).every(m => m.online && m.ready), 'notReady');
      r.gameId = randomUUID(); r.level = 1; r.target = { 2: 12, 3: 10, 4: 8 }[players(r).length]!;
      r.lives = players(r).length; r.stars = 1; deal(r); break;
    case 'play': {
      isPlayer(); requireThat(r.phase === 'active', 'phase'); requireThat(m.hand.length && m.hand[0] === a.card, 'card');
      const card = m.hand.shift()!; r.top = card; r.revealed = [];
      for (const p of players(r)) {
        r.revealed.push(...p.hand.filter(c => c < card)); p.hand = p.hand.filter(c => c > card);
      }
      if (r.revealed.length) { r.lives--; transition(r, 'ready', 'mistake'); event(r, 'mistake'); }
      else event(r, 'card');
      // Keep a mistake visible until the team acknowledges it, even when it emptied all hands.
      if (!r.revealed.length || r.lives <= 0) finishLevel(r);
      break;
    }
    case 'propose':
      isPlayer(); requireThat(r.phase === 'active' && r.stars > 0 && players(r).some(m => m.hand.length), 'phase');
      transition(r, 'vote'); r.votes = [memberId]; event(r, 'vote'); break;
    case 'vote':
      isPlayer(); requireThat(r.phase === 'vote' && typeof a.yes === 'boolean', 'phase');
      if (!a.yes) { r.votes = []; transition(r, 'ready', 'rejected'); event(r, 'rejected'); }
      else {
        if (!r.votes.includes(memberId)) r.votes.push(memberId);
        if (players(r).every(p => p.online && r.votes.includes(p.id))) {
          r.stars--; r.revealed = players(r).flatMap(p => p.hand.length ? [p.hand.shift()!] : []); r.votes = [];
          transition(r, 'ready', 'shuriken'); event(r, 'shuriken');
        }
      }
      break;
    case 'resume':
      isHost(); requireThat(r.phase === 'paused', 'phase');
      for (const p of players(r)) if (!p.online) p.deadline = null;
      transition(r, 'ready', 'reconnect'); break;
    case 'cancel': isHost(); requireThat(r.phase !== 'lobby', 'phase'); lobby(r, 'cancelled'); break;
    case 'lobby': isHost(); requireThat(r.phase === 'finished', 'phase'); lobby(r, 'welcome'); break;
    case 'seat':
      requireThat(r.phase === 'lobby', 'phase');
      if (m.role === 'spectator') { requireThat(players(r).length < 4, 'full'); m.role = 'player'; }
      else { m.role = 'spectator'; }
      transition(r, 'lobby'); syncPresence(r, now); break;
    case 'kick':
    case 'leave': {
      if (a.type === 'kick') isHost();
      const target = r.members.find(p => p.id === (a.type === 'leave' ? m.id : a.target));
      requireThat(target && (a.type === 'leave' || target.id !== m.id), 'invalid');
      if (target.role === 'player') lobby(r, r.phase === 'lobby' ? 'welcome' : 'cancelled');
      r.members = r.members.filter(p => p.id !== target.id); syncPresence(r, now); break;
    }
    default: throw new Error('invalid');
  }
  if (r.phase === 'active' && !players(r).some(p => p.hand.length)) finishLevel(r);
  r.receipts.push(receipt);
  // ponytail: bounded receipts; older replays are also fenced by phase epoch and game ID.
  if (r.receipts.length > 1024) r.receipts.shift();
  return true;
}
export function view(r: Room, self: string): RoomView {
  const { members, receipts, lastSeen, ...publicRoom } = r;
  const deadlines = players(r).flatMap(m => !m.online && m.deadline ? [m.deadline] : []);
  return { ...publicRoom, self, hand: members.find(m => m.id === self)?.hand ?? [], reconnectAt: deadlines.length ? Math.min(...deadlines) : null,
    members: members.map(({ secret, hand, deadline, ...m }) => ({ ...m, count: hand.length })) };
}
