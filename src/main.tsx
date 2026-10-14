import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider, useNavigate } from '@tanstack/react-router';
import { io, type Socket } from 'socket.io-client';
import type { Action, GameResult, Reply, RoomView } from '../shared/types';
import { ConfirmDialog, Icon, InviteCode, interruptsGame, maskInviteCode, ResultDialog } from './ui';
import './styles.css';
import { GuideContent } from './GuideContent';

type Language = 'id' | 'en';
type Translate = (id: string, en: string) => string;
const messages: Record<string, [string, string]> = {
  name: ['Gunakan 1-24 huruf, angka, spasi, titik, tanda hubung, atau underscore.', 'Use 1-24 letters, numbers, spaces, dots, hyphens, or underscores.'],
  nameTaken: ['Nama itu sudah dipakai di room ini.', 'That name is already taken in this room.'],
  expired: ['Room ini sudah berakhir. Buat room baru.', 'This room has expired. Create a new one.'],
  missing: ['Room tidak ditemukan. Periksa kode undanganmu.', 'Room not found. Check your invite code.'],
  full: ['Room ini sudah penuh.', 'This room is full.'],
  session: ['Sesi tidak ditemukan. Muat ulang halaman.', 'Session not found. Reload the page.'],
  replaced: ['Sesi ini dibuka di tab lain. Tab ini tidak lagi aktif.', 'This session is open in another tab. This tab is no longer active.'],
  kicked: ['Host mengeluarkanmu dari room.', 'The host removed you from the room.'],
  left: ['Kamu sudah keluar dari room.', 'You left the room.'],
  stale: ['Meja sudah berubah. Coba lagi.', 'The table changed. Try again.'],
  phase: ['Aksi ini belum tersedia.', 'This action is not available yet.'],
  card: ['Mainkan kartu terendahmu.', 'Play your lowest card.'],
  hostOnly: ['Hanya host yang bisa melakukan ini.', 'Only the host can do this.'],
  playerOnly: ['Aksi ini hanya untuk pemain.', 'Only players can do this.'],
  notReady: ['Perlu 2-4 pemain yang terhubung.', 'You need 2-4 connected players.'],
  rate: ['Terlalu banyak percobaan. Tunggu sebentar.', 'Too many attempts. Wait a moment.'],
  capacity: ['Server sedang penuh. Coba lagi nanti.', 'The server is full. Try again later.'],
  storage: ['Progres gagal disimpan. Minta host memeriksa server.', 'Progress could not be saved. Ask the host to check the server.'],
  network: ['Koneksi terputus. Kami mencoba menyambung lagi.', 'Connection lost. We are trying again.'],
  invalid: ['Aksi tidak dikenali. Muat ulang jika masalah berulang.', 'The action was not recognized. Reload if it continues.'],
  settings: ['Pengaturan room tidak bisa disimpan.', 'Room settings could not be saved.'],
};
const reasons: Record<string, [string, string]> = {
  level: ['Kartu sudah dibagikan. Tekan Siap saat kamu siap.', 'Your cards are ready. Press Ready when you are.'],
  mistake: ['Urutan salah, satu nyawa hilang. Kartu baru sudah dibagikan.', 'Out of order, one life lost. A new hand has been dealt.'],
  shuriken: ['Kartu terendah sudah dibuang.', 'Your lowest cards were discarded.'],
  rejected: ['Shuriken tidak dipakai. Tekan Siap untuk lanjut.', 'No shuriken used. Press Ready to continue.'],
  disconnect: ['Pemain terputus. Permainan dijeda.', 'A player disconnected. The game is paused.'],
  reconnect: ['Pemain sudah kembali. Tekan Siap untuk lanjut.', 'The player is back. Press Ready to continue.'],
  restart: ['Progres sudah dipulihkan. Tekan Siap untuk kembali.', 'Progress was restored. Press Ready to continue.'],
  won: ['Semua level selesai. Kalian menang.', 'Every level is complete. You win.'],
  lost: ['Nyawa habis. Kembali ke lobi untuk mencoba lagi.', 'No lives left. Return to the lobby and try again.'],
  cancelled: ['Permainan dihentikan. Kembali ke lobi.', 'The game was stopped. Return to the lobby.'],
  welcome: ['Bagikan tautan setelah temanmu masuk.', 'Share the link once your friends have joined.'],
};
function read(key: string, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function write(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* browser privacy mode */ } }
function token() {
  let value = read('minds.token');
  if (!/^[a-f0-9]{64}$/.test(value)) { value = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join(''); write('minds.token', value); }
  return value;
}
let audio: AudioContext | undefined;
function sound(kind: string) {
  try {
    audio ??= new AudioContext(); void audio.resume();
    const frequencies: Record<string, number> = { card: 440, mistake: 130, shuriken: 660, level: 520, won: 780, lost: 110, active: 330 };
    const frequency = frequencies[kind]; if (!frequency) return;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.28);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.3);
  } catch { /* Audio is optional; browser restrictions never block play. */ }
}
type ContextValue = {
  t: Translate; lang: Language; setLang: (l: Language) => void; muted: boolean; toggleMute: () => void;
  room: RoomView | null; connected: boolean; error: string; fatal: string; busy: boolean; name: string;
  setName: (s: string) => void; enter: (code?: string) => Promise<string | undefined>; action: (data: Partial<Action> & Pick<Action, 'type'>) => void;
};
const Context = createContext<ContextValue>(null!);
const useGame = () => useContext(Context);
function Provider({ children }: { children: React.ReactNode }) {
  const [lang, updateLang] = useState<Language>(read('minds.language', 'id') === 'en' ? 'en' : 'id');
  const [muted, setMuted] = useState(read('minds.muted') === 'true');
  const [name, updateName] = useState(read('minds.name'));
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(''), [fatal, setFatal] = useState(''), [busy, setBusy] = useState(false);
  const socket = useRef<Socket | null>(null), joined = useRef(''), joining = useRef(false), username = useRef(name), mute = useRef(muted), lastEvent = useRef('');
  username.current = name; mute.current = muted;
  const t: Translate = (id, en) => lang === 'id' ? id : en;
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    const s = io({ auth: { token: token() }, autoConnect: true }); socket.current = s;
    const joinAgain = () => {
      setConnected(true); setError('');
      if (joined.current) s.emit('enter', { code: joined.current, name: username.current }, (reply: Reply) => { if (!reply.ok) setFatal(reply.error); });
    };
    s.on('connect', joinAgain);
    s.on('disconnect', () => { setConnected(false); setBusy(false); });
    s.on('connect_error', () => setError('network'));
    s.on('fatal', (code: string) => { setFatal(code); setBusy(false); joined.current = ''; setRoom(null); setError(''); });
    s.on('state', (state: RoomView) => {
      setRoom(state);
      if (lastEvent.current && lastEvent.current !== state.event.id && !mute.current) sound(state.event.kind);
      lastEvent.current = state.event.id;
    });
    return () => { s.disconnect(); };
  }, []);
  async function enter(code?: string) {
    const s = socket.current;
    if (!s?.connected) { setError('network'); return; }
    if (joined.current === code) return code;
    if (joining.current) return;
    joining.current = true; setBusy(true); setError(''); setFatal('');
    return new Promise<string | undefined>(resolve => {
      s.timeout(8000).emit('enter', { create: !code, code, name: username.current }, (err: unknown, reply: Reply<{ code: string }>) => {
        joining.current = false; setBusy(false);
        if (err) { setError('network'); resolve(undefined); return; }
        if (!reply.ok) { setError(reply.error); resolve(undefined); return; }
        joined.current = reply.data.code; write('minds.lastRoom', reply.data.code); resolve(reply.data.code);
      });
    });
  }
  function action(data: Partial<Action> & Pick<Action, 'type'>) {
    const s = socket.current; if (!s?.connected || !room || fatal) { setError('network'); return; }
    if (busy) return;
    setBusy(true); setError('');
    if (!muted) { try { audio ??= new AudioContext(); void audio.resume(); } catch { /* optional */ } }
    const payload = { ...data, id: crypto.randomUUID(), epoch: room.epoch, gameId: room.gameId };
    s.timeout(7000).emit('action', payload, (err: unknown, reply: Reply) => {
      setBusy(false); if (err) setError('network'); else if (!reply.ok) setError(reply.error);
    });
  }
  return <Context.Provider value={{ t, lang, setLang: l => { updateLang(l); write('minds.language', l); }, muted, toggleMute: () => { setMuted(!muted); write('minds.muted', String(!muted)); }, room, connected, error, fatal, busy, name, setName: n => { updateName(n); username.current = n; write('minds.name', n); }, enter, action }}>{children}</Context.Provider>;
}
function Eye({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 120 72" fill="none" aria-hidden="true"><path d="M5 36Q60-18 115 36Q60 90 5 36Z" /><circle cx="60" cy="36" r="19"/><circle cx="60" cy="36" r="7"/><path d="M60 0v9m0 54v9M15 8l10 8m70 40 10 8M15 64l10-8m70-40 10-8"/></svg>;
}
function Guide({ close }: { close: () => void }) {
  const { t } = useGame(); const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} className="guide" aria-labelledby="guide-title">
    <header className="guide-header">
      <h2 id="guide-title">{t('Cara bermain', 'How to play')}</h2>
      <button autoFocus className="icon-button close" onClick={close} aria-label={t('Tutup panduan', 'Close guide')}><Icon name="close"/></button>
    </header>
    <GuideContent t={t}/>
    <div className="guide-footer"><button className="primary full" onClick={close}>{t('Kembali ke permainan', 'Back to the game')}</button></div>
  </dialog>;
}
function Shell() {
  const { t, lang, setLang, muted, toggleMute, error, fatal } = useGame(); const [guide, setGuide] = useState(false);
  const message = messages[fatal || error];
  return <div className="shell">
    <header className="header"><Link to="/" className="brand" aria-label="The Minds"><Eye/><span>the minds<span className="brand-dot">.</span></span></Link>
      <nav aria-label={t('Pengaturan', 'Settings')}><button className="text-button guide-link" onClick={() => setGuide(true)} aria-label={t('Cara bermain', 'How to play')}><Icon name="help"/><span>{t('Cara bermain', 'How to play')}</span></button>
        <button className="icon-button" aria-label={muted ? t('Aktifkan suara', 'Enable sound') : t('Bisukan suara', 'Mute sound')} aria-pressed={muted} onClick={toggleMute}><Icon name={muted ? 'mute' : 'sound'}/></button>
        <label className="language-picker"><span className="sr-only">{t('Bahasa', 'Language')}</span><select aria-label={t('Bahasa', 'Language')} value={lang} onChange={e => setLang(e.target.value as Language)}><option value="id">ID</option><option value="en">EN</option></select><Icon name="chevronDown" className="language-chevron"/></label>
      </nav>
    </header>
    {message && (!error || fatal || !(typeof window !== 'undefined' && window.location.pathname.startsWith('/room/'))) && <div className="alert" role="alert">{t(...message)} {fatal && <a href="/">{t('Kembali ke awal', 'Back to home')} →</a>}</div>}
    <Outlet/>
    {guide && <Guide close={() => setGuide(false)}/>}
  </div>;
}
function NameField() {
  const { t, name, setName } = useGame();
  return <label className="field">{t('Nama panggilanmu', 'Your nickname')}<input autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} maxLength={24} required placeholder={t('Misalnya, Naya', 'For example, Naya')} aria-describedby="name-hint"/><small id="name-hint">{t('Nama ini terlihat oleh teman satu room.', 'Your friends in the room will see this name.')}</small></label>;
}
function Home() {
  const { t, enter, busy, connected, room } = useGame(); const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'join'>('create'), [code, setCode] = useState('');
  const lastRoom = read('minds.lastRoom');
  async function submit(e: React.FormEvent) { e.preventDefault(); const joined = await enter(mode === 'join' ? code.trim().toUpperCase() : undefined); if (joined) void navigate({ to: '/room/$code', params: { code: joined } }); }
  return <main className="title-screen">
    <div className="title-emblem" aria-hidden="true"><div className="emblem-ring"/><Eye/></div>
    <h1 className="game-title">THE MINDS</h1>
    <p className="title-description">{t('Mainkan kartu berurutan tanpa membocorkan isi tangan.', 'Play your cards in order without revealing your hand.')}</p>
    <section className="game-menu" aria-label={t('Menu permainan', 'Game menu')}>
      {room ? <div className="resume-panel"><p>{t('Kamu masih berada di room ', 'You are still in room ') + room.code}</p><Link className="primary full" to="/room/$code" params={{ code: room.code }}>{t('Lanjutkan permainan', 'Continue game')} <Icon name="arrow"/></Link></div> : <form onSubmit={submit}>
        <div className="tabs" role="group" aria-label={t('Cara masuk', 'How to join')}><button type="button" aria-pressed={mode === 'create'} className={mode === 'create' ? 'selected' : ''} onClick={() => setMode('create')}>{t('Buat room', 'Create room')}</button><button type="button" aria-pressed={mode === 'join'} className={mode === 'join' ? 'selected' : ''} onClick={() => setMode('join')}>{t('Punya kode?', 'Have a code?')}</button></div>
        <NameField/>{mode === 'join' && <label className="field">{t('Kode room', 'Room code')}<input value={code} maxLength={6} minLength={6} required onChange={e => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3" className="code-input"/></label>}
        <button className="primary full" disabled={busy || !connected}>{busy ? t('Menghubungkan…', 'Connecting…') : mode === 'create' ? t('Buat room', 'Create room') : t('Gabung room', 'Join room')}</button>
        {!connected && <p className="form-status" role="status">{t('Sedang menghubungkan ke permainan…', 'Connecting to the game…')}</p>}
        <p className="privacy-note">{t('Bagikan kode room untuk mengajak teman bermain.', 'Share your room code to invite friends.')}</p>
        {/^[A-Z0-9]{6}$/.test(lastRoom) && <Link className="last-room" to="/room/$code" params={{ code: lastRoom }}>{t('Kembali ke room terakhir', 'Return to your last room')} {maskInviteCode(lastRoom)} <Icon name="arrow"/></Link>}
      </form>}
    </section>
    <div className="menu-deck menu-deck-left" aria-hidden="true"><span>17</span><Eye/><b>17</b></div>
    <div className="menu-deck menu-deck-right" aria-hidden="true"><span>68</span><Eye/><b>68</b></div>
    <p className="menu-facts">{t('2-4 pemain, kooperatif, sekitar 20 menit', '2-4 players, cooperative, about 20 minutes')}</p>
  </main>;
}
function RoomPage() {
  const { code: routeCode } = roomRoute.useParams();
  const code = routeCode.toUpperCase();
  const { t, room, name, enter, connected, busy, action, fatal, error } = useGame();
  const attempted = useRef(false), [copied, setCopied] = useState(false);
  // Only returning visitors with a saved name join automatically; typing a new name must not join on the first keystroke.
  const [autoJoin] = useState(() => !!name.trim());
  const [hideCode, setHideCode] = useState(() => read('minds.hideCode') !== 'false');
  const [notice, setNotice] = useState<GameResult | null>(null);
  const resultTimer = useRef<number | null>(null);
  useEffect(() => {
    const result = room?.result;
    const isPlayer = room?.members.find(m => m.id === room.self)?.role === 'player';
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
    if (isPlayer && room?.code === code && result && read('minds.result:' + code) !== result.id) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      resultTimer.current = window.setTimeout(() => setNotice(result), reduced ? 0 : 320);
    }
    return () => { if (resultTimer.current !== null) window.clearTimeout(resultTimer.current); };
  }, [room?.result?.id, code]);
  function closeResult() {
    if (notice) write('minds.result:' + code, notice.id);
    setNotice(null);
  }
  const [confirmation, setConfirmation] = useState<{ type: 'leave' | 'cancel' | 'kick' | 'resume'; target?: string; epoch: number } | null>(null);
  useEffect(() => { if (autoJoin && connected && room?.code !== code && !attempted.current && !fatal) { attempted.current = true; void enter(code); } }, [autoJoin, connected, code, room, fatal]);
  if (fatal) return <main className="empty-state"><Eye/><h1>{t('Sampai bertemu lagi.', 'Until next time.')}</h1><a className="primary" href="/">{t('Kembali ke awal', 'Back to home')}</a></main>;
  if (!room || room.code !== code) return <main className="join-page"><section className="game-menu"><h1>{t('Gabung permainan', 'Join game')}</h1><p className="join-code">{t('Kamu diundang ke room', 'You are invited to room')} <strong>{maskInviteCode(code)}</strong></p><form onSubmit={e => { e.preventDefault(); attempted.current = true; void enter(code); }}><NameField/><button className="primary full" disabled={!connected || busy || !name.trim()}>{busy ? t('Menghubungkan…', 'Connecting…') : t('Gabung room', 'Join room')}</button></form>{error && <p className="form-error" role="alert">{messages[error] ? t(...messages[error]) : t('Room tidak dapat dibuka. Coba lagi.', 'This room could not be opened. Try again.')}</p>}</section></main>;
  const self = room.members.find(m => m.id === room.self)!;
  const host = room.host === self.id, playing = self.role === 'player', isLobby = room.phase === 'lobby';
  const participants = room.members.filter(m => m.role === 'player'), spectators = room.members.filter(m => m.role === 'spectator');
  const disabled = busy || !connected;
  const canDeal = participants.length >= 2 && participants.every(m => m.online);
  const onlinePlayers = participants.filter(m => m.online);
  const readyCount = onlinePlayers.filter(m => m.ready).length;
  const offline = participants.filter(m => !m.online).map(m => m.name).join(', ');
  const voted = (id: string) => room.votes.includes(id);
  const title = isLobby ? (participants.length < 2 ? t('Menunggu pemain', 'Waiting for players') : t('Meja siap', 'Table is set'))
    : room.phase === 'active' ? (playing ? t('Mainkan kartumu', 'Play your cards') : t('Permainan berjalan', 'Game in progress'))
    : room.phase === 'vote' ? t('Gunakan shuriken?', 'Use a shuriken?')
    : room.phase === 'paused' ? t('Permainan dijeda', 'Game paused')
    : room.phase === 'finished' ? (room.reason === 'won' ? t('Kalian menang!', 'You win!') : t('Permainan berakhir', 'Game over'))
    : t(`Siap untuk level ${room.level}?`, `Ready for level ${room.level}?`);
  const subtitle = isLobby ? (participants.length < 2 ? t('Salin tautan dan kirim ke 1-3 teman.', 'Copy the link and send it to 1-3 friends.')
      : !canDeal ? t('Menunggu terhubung: ', 'Waiting to connect: ') + offline
      : host ? t('Semua sudah duduk. Bagikan kartu untuk mulai.', 'Everyone is seated. Deal cards to begin.') : t('Menunggu host membagikan kartu.', 'Waiting for the host to deal.'))
    : room.phase === 'active' ? (playing ? t('Ketuk kartu terendah saat waktunya terasa pas.', 'Tap your lowest card when the moment feels right.') : t('Isi tangan pemain tetap tersembunyi.', 'Players’ hands stay hidden.'))
    : room.phase === 'vote' ? t('Semua pemain harus setuju, termasuk yang sedang offline.', 'Everyone needs to agree, including players who are offline.')
    : t(...(reasons[room.reason] ?? reasons.level));
  async function copy() { const link = location.origin + '/room/' + code; try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { window.prompt(t('Salin tautan ini', 'Copy this link'), link); } }
  function confirmAction(type: 'leave' | 'cancel' | 'kick' | 'resume', target?: string) {
    setConfirmation({ type, target, epoch: room!.epoch });
  }
  const selected = room.members.find(m => m.id === confirmation?.target) ?? self;
  const pendingLabel = confirmation?.type === 'resume' ? t('Tetap lanjutkan', 'Continue anyway') : confirmation?.type === 'kick' ? t('Keluarkan peserta', 'Remove participant') : confirmation?.type === 'cancel' ? t('Akhiri pertandingan', 'End game') : t('Keluar room', 'Leave room');
  const actionError = error && !fatal && <div className="room-action-alert" role="alert">{messages[error] ? t(...messages[error]) : t('Aksi tidak dapat dilakukan. Coba lagi.', 'That action could not be completed. Try again.')}</div>;
  // Empty seats only matter before dealing; mid-game newcomers join as spectators via the room link.
  const seats = isLobby ? Array.from({ length: 4 }, (_, i) => participants[i]) : participants;
  const status = (m: typeof self) => !m.online ? t('Terputus', 'Offline') : m.ready ? t('Siap', 'Ready') : isLobby ? (m.id === room.host ? 'Host' : t('Duduk', 'Seated')) : `${m.count} ${t('kartu', 'cards')}`;
  const kick = (m: typeof self) => host && m.id !== self.id && <button className="remove" aria-label={t('Keluarkan ', 'Remove ') + m.name} onClick={() => confirmAction('kick', m.id)} disabled={disabled}><Icon name="close"/></button>;
  return <main className={'room ' + (isLobby ? 'in-lobby' : 'in-game')}>
    <div className="room-bar">
      <div className="room-invite"><InviteCode code={code} hidden={hideCode} onToggle={() => { setHideCode(!hideCode); write('minds.hideCode', String(!hideCode)); }} t={t}/><button className="chip-button" onClick={copy}><Icon name={copied ? 'check' : 'copy'}/><span aria-live="polite">{copied ? t('Tautan disalin', 'Link copied') : t('Salin tautan', 'Copy link')}</span></button></div>
      <span className={'connection' + (connected ? ' online' : '')} role="status"><span className="connection-dot"/>{connected ? t('Terhubung', 'Connected') : t('Menyambungkan…', 'Reconnecting…')}</span>
    </div>

    <section className="table" aria-label={t('Meja permainan', 'Game table')}>
      <ol className="seat-row" aria-label={t('Pemain di meja', 'Players at the table')}>
        {seats.map((m, i) => m ? <li key={m.id} className={`seat tone-${i}${m.id === self.id ? ' is-self' : ''}${m.ready ? ' is-ready' : ''}${!m.online ? ' is-offline' : ''}`}>
          <span className="seat-token" aria-hidden="true">{m.name.slice(0, 1).toUpperCase()}{m.ready && <Icon name="check"/>}</span>
          <strong className="seat-name">{m.name}{m.id === self.id && <small>{t(' (kamu)', ' (you)')}</small>}</strong>
          <span className="seat-status">{status(m)}</span>
          {!isLobby && <span className="seat-hand" aria-hidden="true">{Array.from({ length: Math.min(m.count, 4) }, (_, n) => <i key={n}/>)}</span>}
        </li> : <li key={i}><button className="seat seat-empty" onClick={copy} aria-label={t('Kursi kosong. Salin tautan undangan', 'Empty seat. Copy invite link')}><span className="seat-token"><Icon name="plus"/></span><strong className="seat-name">{t('Kursi kosong', 'Empty seat')}</strong><span className="seat-status">{t('Undang', 'Invite')}</span></button></li>)}
      </ol>

      {!isLobby && <dl className="hud">
        <div className="hud-level"><dt>Level</dt><dd><strong>{room.level}</strong><small>/{room.target}</small></dd>
          <div className="level-progress" role="progressbar" aria-valuemin={0} aria-valuemax={room.target} aria-valuenow={room.level} aria-label={t(`Level ${room.level} dari ${room.target}`, `Level ${room.level} of ${room.target}`)}>{Array.from({ length: room.target }, (_, index) => <i key={index} className={index + 1 < room.level ? 'done' : index + 1 === room.level ? 'current' : ''}/>)}</div></div>
        <div><dt>{t('Nyawa', 'Lives')}</dt><dd className="lives" key={room.lives} aria-label={`${room.lives} ${t('nyawa', 'lives')}`}>{room.lives ? Array.from({ length: room.lives }, (_, i) => <Icon name="heart" key={i}/>) : '0'}</dd></div>
        <div><dt>Shuriken</dt><dd className="stars" key={room.stars} aria-label={`${room.stars} shuriken`}>{room.stars ? Array.from({ length: room.stars }, (_, i) => <Icon name="star" key={i}/>) : '0'}</dd></div>
      </dl>}

      <div className="table-center">
        {isLobby ? <div className="lobby-deck" aria-hidden="true"><span>17</span><span>34</span><span>68</span></div> : <>
          <p className="sr-only" role="status" aria-atomic="true">{room.top === null ? t('Belum ada kartu dimainkan.', 'No card played yet.') : t('Kartu teratas: ', 'Top card: ') + room.top}</p>
          <div className={'pile-card' + (room.top === null ? ' card-back' : '') + (room.event.kind === 'card' ? ' card-landed' : '')} key={`${room.gameId}-${room.level}-${room.top}`} aria-hidden="true">{room.top === null ? <Eye/> : <><span>{room.top}</span><strong>{room.top}</strong><span>{room.top}</span></>}</div>
        </>}
        <div className="table-message" aria-live="polite"><h2>{title}</h2><p>{subtitle}</p></div>
        {room.revealed.length > 0 && <div className="revealed"><span>{room.reason === 'shuriken' ? t('Dibuang lewat shuriken', 'Discarded by shuriken') : t('Kartu terlewat', 'Missed cards')}</span><div>{[...room.revealed].sort((a, b) => a - b).map(c => <span key={c}>{c}</span>)}</div></div>}
        {room.phase === 'vote' && <ul className="vote-status" aria-label={t('Status voting', 'Vote status')}>{participants.map(m => <li key={m.id} className={voted(m.id) ? 'yes' : ''}>{voted(m.id) && <Icon name="check"/>}{m.name}<span className="sr-only">{voted(m.id) ? t(' setuju', ' approved') : t(' belum memilih', ' not voted yet')}</span></li>)}</ul>}
        {isLobby && <div className="lobby-cta">
          {participants.length < 2 ? <button className="primary" onClick={copy}><Icon name={copied ? 'check' : 'copy'}/>{copied ? t('Tautan disalin', 'Link copied') : t('Salin tautan undangan', 'Copy invite link')}</button>
            : host && <button className="primary" disabled={disabled || !canDeal} onClick={() => action({ type: 'start' })}>{t('Bagikan kartu', 'Deal cards')}<Icon name="arrow"/></button>}
          <span className="lobby-count">{participants.length}/4 {t('pemain', 'players')}{spectators.length > 0 && `, ${spectators.length} ${t('penonton', 'watching')}`}</span>
        </div>}
        {isLobby && actionError}
        {!isLobby && offline && <p className="offline-note">{offline} {t('sedang offline. Kartunya tetap dihitung.', 'is offline. Their cards still count.')}{room.phase === 'active' && room.reconnectAt && ' ' + t('Permainan dijeda jika batas kembali terlewati.', 'Play pauses when the reconnect window ends.')}</p>}
      </div>
    </section>

    {!isLobby && <section className="tray" aria-label={playing ? t('Kartumu', 'Your hand') : t('Kamu menonton', 'You are watching')}>
      {actionError}
      {playing && room.phase !== 'finished' && <>
        <div className="hand-heading"><span>{t('Kartumu', 'Your hand')}</span><span>{t('Hanya terlihat olehmu', 'Only you can see these')}</span></div>
        {notice ? <p className="muted">{t('Tutup hasil untuk melihat kartu.', 'Close the result to see your cards.')}</p>
          : room.hand.length ? <div className={'hand' + (room.hand.length > 5 ? ' is-fanned' : '')} style={{ '--n': room.hand.length } as React.CSSProperties}>{room.hand.map((card, i) => <button key={card} style={{ '--i': i } as React.CSSProperties} className={'hand-card' + (i === 0 ? ' lowest' : '')} disabled={disabled || room.phase !== 'active' || i !== 0} aria-label={(i === 0 ? t('Mainkan kartu ', 'Play card ') : t('Kartu ', 'Card ')) + card} onClick={() => action({ type: 'play', card })}><span>{card}</span><strong>{card}</strong></button>)}</div>
          : <p className="muted">{t('Kartumu sudah habis. Tetap bersama tim.', 'Your hand is empty. Stay with your team.')}</p>}
      </>}
      {!playing && room.phase !== 'finished' && <p className="muted">{t('Kamu menonton. Kamu bisa ikut di permainan berikutnya.', 'You are watching. You can join the next game.')}</p>}
      <div className="tray-actions">
        {room.phase === 'ready' && playing && <><button className={self.ready ? 'secondary ready-state' : 'primary'} disabled={disabled || !!notice} onClick={() => action({ type: self.ready ? 'unready' : 'ready' })}>{self.ready ? t('Batal siap', 'Cancel ready') : t('Aku siap', 'I’m ready')}</button><span className="muted">{readyCount}/{onlinePlayers.length} {t('siap', 'ready')}</span></>}
        {room.phase === 'active' && playing && <button className="shuriken-button" disabled={disabled || room.stars === 0} onClick={() => action({ type: 'propose' })}><Icon name="star"/>{t('Usulkan shuriken', 'Suggest shuriken')}</button>}
        {room.phase === 'vote' && playing && <><button className="secondary" disabled={disabled} onClick={() => action({ type: 'vote', yes: false })}>{t('Tolak', 'Decline')}</button><button className="primary" disabled={disabled || voted(self.id)} onClick={() => action({ type: 'vote', yes: true })}>{voted(self.id) ? <><Icon name="check"/>{t('Sudah setuju', 'Approved')}</> : t('Setuju', 'Approve')}</button></>}
        {room.phase === 'paused' && (host ? <button className="primary" disabled={disabled} onClick={() => participants.some(m => !m.online) ? confirmAction('resume') : action({ type: 'resume' })}>{t('Lanjutkan permainan', 'Resume game')}</button> : <p className="muted">{t('Menunggu pemain kembali atau host melanjutkan.', 'Waiting for players to return or the host to resume.')}</p>)}
        {room.phase === 'finished' && (host ? <button className="primary" disabled={disabled} onClick={() => action({ type: 'lobby' })}>{t('Kembali ke lobi', 'Back to lobby')}<Icon name="arrow"/></button> : <p className="muted">{t('Menunggu host kembali ke lobi.', 'Waiting for the host to return to the lobby.')}</p>)}
      </div>
    </section>}

    <details className="room-management"><summary><span>{t('Pemain & pengaturan room', 'Players & room settings')}</span><small>{participants.length}/4 {t('pemain', 'players')}{spectators.length > 0 && `, ${spectators.length} ${t('penonton', 'watching')}`}</small></summary><div className="roster">
      <ul className="roster-list">{[...participants, ...spectators].map(m => <li key={m.id} className={m.id === self.id ? 'self' : ''}>
        <span className="avatar">{m.name.slice(0, 1).toUpperCase()}<span className={'connection-dot' + (m.online ? ' online' : '')}/></span>
        <span className="roster-copy"><strong>{m.name}{m.id === self.id && <small>{t(' (kamu)', ' (you)')}</small>}</strong><span>{m.role === 'spectator' ? t('Penonton', 'Watching') : (m.id === room.host ? 'Host, ' : '') + status(m).toLowerCase()}</span></span>
        {kick(m)}</li>)}</ul>
      {isLobby && <section className="settings"><h3>{t('Saat koneksi terputus', 'When a player disconnects')}</h3><label className="field"><span className="sr-only">{t('Kebijakan koneksi', 'Connection policy')}</span><select disabled={!host || disabled} value={room.settings.disconnect} onChange={e => action({ type: 'settings', settings: { ...room.settings, disconnect: e.target.value as 'pause' | 'continue' } })}><option value="pause">{t('Jeda otomatis', 'Pause immediately')}</option><option value="continue">{t('Lanjut sementara', 'Continue temporarily')}</option></select></label>{room.settings.disconnect === 'continue' && <label className="field">{t('Batas waktu kembali', 'Time to reconnect')}<select value={room.settings.timeout} disabled={!host || disabled} onChange={e => action({ type: 'settings', settings: { ...room.settings, timeout: Number(e.target.value) as 30 | 60 | 120 } })}>{[30, 60, 120].map(n => <option key={n} value={n}>{n} {t('detik', 'seconds')}</option>)}</select></label>}<p className="muted">{host ? t('Kartu pemain offline tetap diperhitungkan.', 'Offline players’ cards still count.') : t('Hanya host yang dapat mengubah pengaturan ini.', 'Only the host can change this setting.')}</p></section>}
      <div className="roster-actions">{isLobby && <button className="text-button" disabled={disabled || !playing && participants.length >= 4} onClick={() => action({ type: 'seat' })}>{playing ? t('Jadi penonton', 'Watch instead') : t('Ikut bermain', 'Take a seat')}</button>}{!isLobby && host && <button className="text-button" disabled={disabled} onClick={() => confirmAction('cancel')}>{t('Akhiri pertandingan', 'End game')}</button>}<button className="text-button danger" disabled={disabled} onClick={() => confirmAction('leave')}>{t('Keluar room', 'Leave room')}</button></div>
    </div></details>
    {notice && playing && <ResultDialog
      key={notice.id}
      result={notice}
      t={t}
      isHost={host}
      onLobby={() => action({ type: 'lobby' })}
      onClose={closeResult}
    />}
    {confirmation && !notice && <ConfirmDialog
      title={confirmation.type === 'kick' ? t('Keluarkan ', 'Remove ') + selected.name + '?' : pendingLabel + '?'}
      message={confirmation.epoch !== room.epoch ? t('Kondisi meja sudah berubah. Tutup pesan ini dan periksa meja dulu.', 'The table has changed. Close this message and check the table first.') : confirmation.type === 'resume' ? t('Kartu pemain offline tetap dihitung. Tim bisa kehilangan nyawa meski mereka belum kembali.', 'Offline players’ cards still count. The team can lose lives before they return.') : interruptsGame(confirmation.type, selected.role, room.phase) ? t('Pertandingan ini akan dibatalkan. Pemain lain kembali ke lobi dan bisa mulai lagi.', 'This game will be cancelled. Everyone else returns to the lobby and can start again.') : confirmation.type === 'kick' ? t('Peserta ini akan dikeluarkan dari room. Permainan tetap berjalan.', 'This participant will leave the room. The game continues.') : confirmation.type === 'cancel' ? t('Semua peserta akan kembali ke lobi.', 'Everyone will return to the lobby.') : t('Kamu akan keluar dari room. Peserta lain tetap berada di meja.', 'You will leave the room. The others will stay at the table.')}
      confirmLabel={pendingLabel}
      cancelLabel={t('Batal', 'Cancel')}
      disabled={disabled || confirmation.epoch !== room.epoch}
      onClose={() => setConfirmation(null)}
      onConfirm={() => { action({ type: confirmation.type, target: confirmation.target }); setConfirmation(null); }}
    />}
  </main>;
}
const rootRoute = createRootRoute({ component: Shell });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home });
const roomRoute = createRoute({ getParentRoute: () => rootRoute, path: '/room/$code', component: RoomPage });
const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, roomRoute]), defaultNotFoundComponent: () => <main className="empty-state"><h1>404</h1><Link to="/">The Minds →</Link></main> });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
createRoot(document.getElementById('root')!).render(<Provider><RouterProvider router={router}/></Provider>);
