import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider, useNavigate } from '@tanstack/react-router';
import { io, type Socket } from 'socket.io-client';
import type { Action, Reply, RoomView } from '../shared/types';
import { ConfirmDialog, Icon, interruptsGame } from './ui';
import './styles.css';

type Language = 'id' | 'en';
type Translate = (id: string, en: string) => string;
const messages: Record<string, [string, string]> = {
  name: ['Gunakan 1–24 huruf, angka, spasi, titik, - atau _.', 'Use 1–24 letters, numbers, spaces, dots, - or _.'],
  nameTaken: ['Username sudah digunakan di room ini. Pilih nama lain.', 'This username is taken in this room. Choose another.'],
  expired: ['Room telah kedaluwarsa. Buat room baru.', 'This room has expired. Create a new room.'],
  missing: ['Room tidak ditemukan. Periksa kode undangan.', 'Room not found. Check your invitation code.'],
  full: ['Tempat sudah penuh.', 'There are no available seats.'],
  session: ['Sesi tidak tersedia. Muat ulang halaman.', 'Session unavailable. Reload the page.'],
  replaced: ['Sesi dilanjutkan di tab lain. Tab ini dinonaktifkan.', 'Your session is active in another tab. This tab is now inactive.'],
  kicked: ['Host telah mengeluarkanmu dari room.', 'The host removed you from the room.'],
  left: ['Kamu telah keluar dari room.', 'You have left the room.'],
  stale: ['Meja telah berubah. Coba aksi lagi.', 'The table has changed. Try your action again.'],
  phase: ['Aksi belum tersedia pada fase ini.', 'This action is not available in this phase.'],
  card: ['Hanya kartu terendah yang dapat dimainkan.', 'Only your lowest card can be played.'],
  hostOnly: ['Hanya host yang dapat melakukan ini.', 'Only the host can do this.'],
  playerOnly: ['Aksi ini hanya untuk pemain.', 'This action is for players only.'],
  notReady: ['Perlu 2–4 pemain online yang semuanya siap.', 'You need 2–4 online players, all ready.'],
  rate: ['Terlalu banyak aksi. Tunggu sebentar, lalu coba lagi.', 'Too many actions. Wait a moment and try again.'],
  capacity: ['Server sedang penuh. Coba lagi nanti.', 'The server is full. Please try again later.'],
  storage: ['Progres tidak dapat disimpan. Permainan dihentikan; hubungi host.', 'Progress could not be saved. Play is stopped; contact the host.'],
  network: ['Koneksi belum tersedia. Kami mencoba menyambungkan kembali.', 'Connection unavailable. We are trying to reconnect.'],
  invalid: ['Aksi tidak valid. Muat ulang jika masalah berulang.', 'Invalid action. Reload if the problem continues.'],
  settings: ['Pengaturan room tidak valid.', 'Invalid room settings.'],
};
const reasons: Record<string, [string, string]> = {
  level: ['Lihat kartumu, lalu tekan Siap. Kita mulai bersama.', 'Check your cards, then press Ready. We’ll start together.'],
  mistake: ['Ada kartu yang terlewat. Satu nyawa hilang.', 'Some cards were missed. One life lost.'],
  shuriken: ['Kartu terendah kalian telah dibuang.', 'Your lowest cards have been set aside.'],
  rejected: ['Shuriken tidak terpakai. Tekan Siap untuk melanjutkan.', 'No shuriken used. Press Ready to continue.'],
  disconnect: ['Pemain terputus. Meja sedang dijeda.', 'A player disconnected. The table is paused.'],
  reconnect: ['Kembali bersama. Siap untuk melanjutkan?', 'Together again. Ready to continue?'],
  restart: ['Progres dipulihkan. Siapkan diri untuk kembali.', 'Progress restored. Get ready to return.'],
  won: ['Semua level selesai. Kalian menang bersama.', 'Every level completed. Your team wins.'],
  lost: ['Nyawa habis. Kembali ke lobi untuk mencoba lagi.', 'No lives left. Return to the lobby to try again.'],
  cancelled: ['Permainan dibatalkan. Siapkan tim baru.', 'Game cancelled. Get the team ready again.'],
  welcome: ['Bagikan undangan, lalu tekan Siap saat semua sudah bergabung.', 'Share an invitation, then press Ready when everyone has joined.'],
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
    s.on('fatal', (code: string) => { setFatal(code); setBusy(false); joined.current = ''; });
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
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} className="guide" aria-labelledby="guide-title">
    <button className="icon-button close" onClick={close} aria-label={t('Tutup panduan', 'Close guide')}><Icon name="close"/></button>
    <h2 id="guide-title">{t('Cara bermain', 'How to play')}</h2>
    <p>{t('Kalian satu tim. Mainkan semua kartu dari angka terkecil ke terbesar, tanpa membocorkan isi tangan. Tidak ada giliran.', 'You are one team. Play every card from lowest to highest, without revealing your hand. There are no turns.')}</p>
    <ol>
      <li><strong>{t('Siapkan pikiran.', 'Get in sync.')}</strong> {t('Setiap level memberi kartu sejumlah level kepada setiap pemain. Semua menekan Siap untuk mulai.', 'Each player receives as many cards as the level number. Everyone presses Ready to begin.')}</li>
      <li><strong>{t('Percayai timing.', 'Trust your timing.')}</strong> {t('Ketuk kartu terendah saat kamu merasa waktunya tepat. Tanpa konfirmasi dan tanpa undo.', 'Tap your lowest card when the moment feels right. No confirmation and no undo.')}</li>
      <li><strong>{t('Saling menjaga.', 'Stay together.')}</strong> {t('Kartu yang terlewat dibuka dan dibuang. Tim kehilangan satu nyawa per kesalahan, lalu bersiap kembali.', 'Missed cards are revealed and discarded. The team loses one life per mistake, then gets ready again.')}</li>
      <li><strong>Shuriken.</strong> {t('Jika semua setuju, satu shuriken membuang kartu terendah masing-masing pemain. Pemain offline tetap harus menyetujui.', 'With unanimous approval, one shuriken discards each player’s lowest card. Offline players must return to vote.')}</li>
    </ol>
    <table><thead><tr><th>{t('Pemain', 'Players')}</th><th>{t('Nyawa', 'Lives')}</th><th>{t('Target level', 'Final level')}</th></tr></thead><tbody>{[[2, 2, 12], [3, 3, 10], [4, 4, 8]].map(row => <tr key={row[0]}>{row.map((n, i) => <td key={i}>{n}</td>)}</tr>)}</tbody></table>
    <p>{t('Mulai dengan 1 shuriken. Hadiah: shuriken di level 2, 5, 8; nyawa di level 3, 6, 9. Maksimum 3 shuriken dan 5 nyawa.', 'Start with 1 shuriken. Rewards: shuriken at levels 2, 5, 8; lives at levels 3, 6, 9. Maximum 3 shuriken and 5 lives.')}</p>
    <h3>{t('Di meja online', 'At the online table')}</h3>
    <p>{t('Urutan mengikuti aksi yang diterima server; koneksi dapat memengaruhi timing. Host mengatur jeda saat koneksi putus. Kartu pemain offline tetap dihitung. Tidak ada tombol fokus ulang, riwayat kartu, atau alat bantu hitung waktu.', 'Order follows the actions received by the server; connection speed can affect timing. The host configures disconnect pauses. Offline players’ cards still count. There is no refocus button, card history, or timing aid.')}</p>
    <p className="muted">{t('Sesi kembali di browser yang sama. Room berakhir 24 jam setelah pemain terakhir keluar. Penonton tidak memperpanjang waktu ini.', 'Resume in the same browser. Rooms expire 24 hours after the last player leaves. Spectators do not extend this time.')}</p>
    <button className="primary full" onClick={close}>{t('Mengerti, kembali ke meja', 'Got it, back to the table')}</button>
  </dialog>;
}
function Shell() {
  const { t, lang, setLang, muted, toggleMute, error, fatal } = useGame(); const [guide, setGuide] = useState(false);
  const message = messages[fatal || error];
  return <div className="shell">
    <header className="header"><Link to="/" className="brand" aria-label="The Minds"><Eye/><span>the minds<span className="brand-dot">.</span></span></Link>
      <nav aria-label={t('Pengaturan', 'Settings')}><button className="text-button guide-link" onClick={() => setGuide(true)} aria-label={t('Cara bermain', 'How to play')}><Icon name="help"/><span>{t('Cara bermain', 'How to play')}</span></button>
        <button className="icon-button" aria-label={muted ? t('Aktifkan suara', 'Enable sound') : t('Bisukan suara', 'Mute sound')} aria-pressed={muted} onClick={toggleMute}><Icon name={muted ? 'mute' : 'sound'}/></button>
        <select aria-label={t('Bahasa', 'Language')} value={lang} onChange={e => setLang(e.target.value as Language)}><option value="id">ID</option><option value="en">EN</option></select>
      </nav>
    </header>
    {message && <div className="alert" role="alert">{t(...message)} {fatal && <a href="/">{t('Kembali ke awal', 'Back to home')} →</a>}</div>}
    <Outlet/>
    <footer><span>{t('Room privat · 2–4 pemain', 'Private rooms · 2–4 players')}</span><button className="text-button" onClick={() => setGuide(true)}>{t('Aturan permainan', 'Game rules')} <Icon name="help"/></button></footer>
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
        <button className="primary full" disabled={busy || !connected}>{busy ? t('Menghubungkan…', 'Connecting…') : mode === 'create' ? t('Buat room', 'Create room') : t('Gabung room', 'Join room')} <Icon name="arrow"/></button>
        {!connected && <p className="form-status" role="status">{t('Sedang menghubungkan ke permainan…', 'Connecting to the game…')}</p>}
        <p className="privacy-note">{t('Bagikan kode room untuk mengajak teman bermain.', 'Share your room code to invite friends.')}</p>
        {/^[A-Z0-9]{6}$/.test(lastRoom) && <Link className="last-room" to="/room/$code" params={{ code: lastRoom }}>{t('Kembali ke room terakhir', 'Return to your last room')} · {lastRoom} →</Link>}
      </form>}
    </section>
    <div className="menu-deck menu-deck-left" aria-hidden="true"><span>17</span><Eye/><b>17</b></div>
    <div className="menu-deck menu-deck-right" aria-hidden="true"><span>68</span><Eye/><b>68</b></div>
    <p className="menu-facts">{t('2–4 pemain · Kooperatif · Sekitar 20 menit', '2–4 players · Cooperative · About 20 minutes')}</p>
  </main>;
}
function RoomPage() {
  const { code: routeCode } = roomRoute.useParams();
  const code = routeCode.toUpperCase();
  const { t, room, name, enter, connected, busy, action, fatal, error } = useGame();
  const attempted = useRef(false), [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState<{ type: 'leave' | 'cancel' | 'kick' | 'resume'; target?: string; epoch: number } | null>(null);
  useEffect(() => { if (connected && name && room?.code !== code && !attempted.current && !fatal) { attempted.current = true; void enter(code); } }, [connected, code, room, name, fatal]);
  if (fatal) return <main className="empty-state"><Eye/><h1>{t('Sampai bertemu lagi.', 'Until next time.')}</h1><a className="primary" href="/">{t('Kembali ke awal', 'Back to home')}</a></main>;
  if (!room || room.code !== code) return <main className="join-page"><section className="game-menu"><h1>{t('Gabung permainan', 'Join game')}</h1><p className="join-code">Room <strong>{code}</strong></p><form onSubmit={e => { e.preventDefault(); attempted.current = true; void enter(code); }}><NameField/><button className="primary full" disabled={!connected || busy}>{busy ? t('Menghubungkan…', 'Connecting…') : t('Gabung room', 'Join room')} <Icon name="arrow"/></button></form>{error && <p className="muted">{t('Periksa nama dan kode, lalu coba lagi.', 'Check your name and code, then try again.')}</p>}</section></main>;
  const self = room.members.find(m => m.id === room.self)!;
  const host = room.host === self.id, playing = self.role === 'player', isLobby = room.phase === 'lobby';
  const participants = room.members.filter(m => m.role === 'player'), spectators = room.members.filter(m => m.role === 'spectator');
  const disabled = busy || !connected;
  const allReady = participants.length >= 2 && participants.every(m => m.online && m.ready);
  const title = room.phase === 'active' ? t('Mainkan kartumu', 'Play your cards') : room.phase === 'vote' ? t('Gunakan shuriken?', 'Use a shuriken?') : room.phase === 'paused' ? t('Permainan dijeda', 'Game paused') : room.phase === 'finished' ? room.reason === 'won' ? t('Kalian menang!', 'You win!') : t('Permainan berakhir', 'Game over') : t('Siap untuk level ini?', 'Ready for this level?');
  async function copy() { try { await navigator.clipboard.writeText(location.origin + '/room/' + code); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { window.prompt(t('Salin tautan ini', 'Copy this link'), location.href); } }
  function confirmAction(type: 'leave' | 'cancel' | 'kick' | 'resume', target?: string) {
    setConfirmation({ type, target, epoch: room!.epoch });
  }
  const selected = room.members.find(m => m.id === confirmation?.target) ?? self;
  const pendingLabel = confirmation?.type === 'resume' ? t('Tetap lanjutkan', 'Continue anyway') : confirmation?.type === 'kick' ? t('Keluarkan peserta', 'Remove participant') : confirmation?.type === 'cancel' ? t('Akhiri pertandingan', 'End game') : t('Keluar room', 'Leave room');
  return <main className={'room-layout ' + (isLobby ? 'in-lobby' : 'in-game')}>
    <div className="room-toolbar"><div><strong className="room-code">{code}</strong><button className="invite-button" onClick={copy}><Icon name={copied ? 'check' : 'copy'}/><span aria-live="polite">{copied ? t('Tautan disalin', 'Link copied') : t('Salin undangan', 'Copy invite')}</span></button></div><span className="connection-label"><span className={'connection-dot ' + (connected ? 'online' : '')}/>{connected ? t('Terhubung', 'Connected') : t('Menyambungkan kembali…', 'Reconnecting…')}</span></div>

    <section className="table-area">
      <div className="table-players" aria-label={t('Pemain di meja', 'Players at the table')}>
        {Array.from({ length: 4 }, (_, i) => { const m = participants[i]; return m ? <div className={`table-player tone-${i} ${m.id === self.id ? 'is-self' : ''} ${m.ready ? 'is-ready' : ''} ${!m.online ? 'is-offline' : ''}`} key={m.id}>
          <div className="player-token"><span>{m.name.slice(0, 1).toUpperCase()}</span>{m.ready && <Icon name="check"/>}</div>
          <strong>{m.name}{m.id === self.id && <small>{t(' (kamu)', ' (you)')}</small>}</strong>
          <span className="player-status">{!m.online ? t('Terputus', 'Disconnected') : m.ready ? t('Siap', 'Ready') : isLobby ? t('Belum siap', 'Not ready') : `${m.count} ${t('kartu', 'cards')}`}</span>
          {!isLobby && <div className="hidden-hand" aria-hidden="true">{Array.from({ length: Math.min(m.count, 3) }, (_, n) => <i key={n}/>)}</div>}
        </div> : <button className="table-player empty-player" key={i} onClick={copy}><span className="player-token"><Icon name="plus"/></span><strong>{isLobby ? t('Undang teman', 'Invite friend') : t('Undang penonton', 'Invite spectator')}</strong><span className="player-status">{t('Kursi kosong', 'Empty seat')}</span></button>; })}
      </div>
      {!isLobby && <div className="game-stats"><div><span className="eyebrow">LEVEL</span><strong>{room.level}<small> / {room.target}</small></strong></div><div><span className="eyebrow">{t('NYAWA', 'LIVES')}</span><strong className="lives" aria-label={`${room.lives} ${t('nyawa', 'lives')}`}>{Array.from({ length: room.lives }, (_, i) => <Icon name="heart" key={i}/>)}</strong></div><div><span className="eyebrow">SHURIKEN</span><strong className="stars"><Icon name="star"/> <small>× {room.stars}</small></strong></div></div>}
      <div className="table-message" aria-live="polite"><h2>{isLobby ? t('Menunggu pemain', 'Waiting for players') : title}</h2><p>{isLobby ? t(...(reasons[room.reason] ?? reasons.welcome)) : room.phase === 'active' ? t('Ketuk kartu terendah saat waktunya terasa pas.', 'Tap your lowest card when the moment feels right.') : room.phase === 'vote' ? t('Semua pemain harus setuju, termasuk yang sedang offline.', 'Everyone needs to agree, including players who are offline.') : t(...(reasons[room.reason] ?? reasons.welcome))}</p></div>
      {isLobby ? <div className="lobby-center"><div className="lobby-invite"><div className="invitation-cards" aria-hidden="true"><span>17</span><span>34</span><span>68</span></div><button className="secondary" onClick={copy}><Icon name={copied ? 'check' : 'copy'}/>{copied ? t('Undangan disalin', 'Invite copied') : t('Undang teman', 'Invite friends')}</button></div><div className="lobby-actions">{playing && <button className={self.ready ? 'secondary ready-state' : 'primary'} disabled={disabled || self.ready} onClick={() => action({ type: 'ready' })}>{self.ready && <Icon name="check"/>}{self.ready ? t('Kamu siap', 'You’re ready') : t('Aku siap', 'I’m ready')}</button>}{host && <button className="primary" disabled={disabled || !allReady} onClick={() => action({ type: 'start' })}>{t('Mulai permainan', 'Start game')} <Icon name="arrow"/></button>}</div><p className="waiting-note" role="status">{participants.length < 2 ? t('Perlu ', 'Need ') + (2 - participants.length) + t(' pemain lagi untuk mulai.', ' more player(s) to begin.') : !allReady ? t('Menunggu siap: ', 'Waiting for: ') + participants.filter(m => !m.ready || !m.online).map(m => m.name).join(', ') : host ? t('Semua siap. Kamu bisa mulai!', 'Everyone’s ready. Start when you like!') : t('Semua siap. Menunggu host memulai.', 'Everyone’s ready. Waiting for the host to start.')}</p></div> : <>
        <p className="sr-only" role="status" aria-atomic="true">{room.top === null ? t('Belum ada kartu dimainkan.', 'No card played yet.') : t('Kartu teratas: ', 'Top card: ') + room.top}</p>
        <div className="play-surface"><span className="surface-line left"/><div className={'table-card ' + (room.top === null ? 'card-back' : '')} key={`${room.gameId}-${room.level}-${room.top}`} aria-hidden="true">{room.top === null ? <Eye/> : <><span>{room.top}</span><strong>{room.top}</strong><span>{room.top}</span></>}</div><span className="surface-line right"/></div>
        {room.revealed.length > 0 && <div className="revealed" aria-live="polite"><span>{t('Kartu dibuang', 'Cards discarded')}</span><div>{[...room.revealed].sort((a, b) => a - b).map(c => <span key={c}>{c}</span>)}</div></div>}
        <div className="phase-actions">
          {room.phase === 'ready' && playing && <><button className={self.ready ? 'secondary ready-state' : 'primary'} disabled={disabled || self.ready} onClick={() => action({ type: 'ready' })}>{self.ready ? t('Menunggu teman', 'Waiting for friends') : t('Aku siap', 'I’m ready')}</button><span className="muted">{participants.filter(m => m.online && m.ready).length}/{participants.filter(m => m.online).length} {t('siap', 'ready')}</span></>}
          {room.phase === 'paused' && host && <button className="primary" disabled={disabled} onClick={() => participants.some(m => !m.online) ? confirmAction('resume') : action({ type: 'resume' })}>{t('Lanjutkan permainan', 'Resume game')} <Icon name="arrow"/></button>}
          {room.phase === 'paused' && !host && <p className="muted">{t('Menunggu pemain kembali atau host melanjutkan.', 'Waiting for players to return or the host to resume.')}</p>}
          {room.phase === 'vote' && <><div className="vote-status">{participants.map(m => <span key={m.id} className={room.votes.includes(m.id) ? 'yes' : ''}>{m.name} {room.votes.includes(m.id) ? <Icon name="check"/> : null}</span>)}</div>{playing && <div className="vote-buttons"><button className="secondary" disabled={disabled} onClick={() => action({ type: 'vote', yes: false })}>{t('Tolak', 'Decline')}</button><button className="primary" disabled={disabled || room.votes.includes(self.id)} onClick={() => action({ type: 'vote', yes: true })}>{room.votes.includes(self.id) ? t('Sudah setuju', 'Approved') : t('Setuju', 'Approve')}</button></div>}</>}
          {room.phase === 'finished' && (host ? <button className="primary" disabled={disabled} onClick={() => action({ type: 'lobby' })}>{t('Kembali ke lobi', 'Back to lobby')} <Icon name="arrow"/></button> : <p>{t('Menunggu host kembali ke lobi.', 'Waiting for the host to return to the lobby.')}</p>)}
        </div>
        {room.phase !== 'finished' && <section className="hand-area"><div className="hand-heading"><span className="eyebrow">{playing ? t('KARTUMU', 'YOUR HAND') : t('KAMU MENONTON', 'YOU ARE WATCHING')}</span>{playing && <span>{t('Hanya kamu yang bisa melihatnya', 'Only you can see these')}</span>}</div>{playing ? <div className="hand">{room.hand.length ? room.hand.map((card, i) => <button key={card} className={'hand-card ' + (i === 0 ? 'lowest' : '')} disabled={disabled || room.phase !== 'active' || i !== 0} aria-label={t('Mainkan kartu ', 'Play card ') + card} onClick={() => action({ type: 'play', card })}><span>{card}</span><strong>{card}</strong><span>{i === 0 ? <Icon name="arrow"/> : null}</span></button>) : <p className="muted">{t('Kartumu sudah habis. Tetap bersama tim.', 'Your hand is empty. Stay with your team.')}</p>}</div> : <p className="muted">{t('Isi tangan pemain tetap tersembunyi. Kamu bisa ikut di permainan berikutnya.', 'Players’ hands stay hidden. You can join the next game.')}</p>}
          {playing && <button className="shuriken-button" disabled={disabled || room.phase !== 'active' || room.stars === 0} onClick={() => action({ type: 'propose' })}><Icon name="star"/> {t('Usulkan shuriken', 'Suggest shuriken')} <small>× {room.stars}</small></button>}
        </section>}
      </>}
      {!isLobby && host && <button className="text-button end-game" disabled={disabled} onClick={() => confirmAction('cancel')}>{t('Akhiri pertandingan', 'End game')}</button>}
      {!isLobby && participants.some(m => !m.online) && <p className="offline-note">{participants.filter(m => !m.online).map(m => m.name).join(', ')} {t('sedang offline. Kartunya tetap dihitung.', 'is offline. Their cards still count.')}{room.phase === 'active' && room.reconnectAt && ' ' + t('Permainan dijeda jika batas kembali terlewati.', 'Play pauses when the reconnect window ends.')}</p>}
    </section>
    <details className="room-management"><summary>{t('Pemain & pengaturan room', 'Players & room settings')}<span>{participants.length}/4 · {spectators.length} {t('penonton', 'watching')}</span></summary><aside className="roster"><div className="section-label"><h2>{t('Di meja', 'At the table')}</h2><span>{participants.length}/4</span></div>
      <div className="seats">{Array.from({ length: 4 }, (_, i) => { const m = participants[i]; return m ? <div key={m.id} className={'seat ' + (m.id === self.id ? 'self' : '')}>
        <div className="avatar">{m.name.slice(0, 1).toUpperCase()}<span className={'connection-dot ' + (m.online ? 'online' : '')}/></div><div className="seat-copy"><strong>{m.name} {m.id === self.id && <small>{t('(kamu)', '(you)')}</small>}</strong><span>{m.id === room.host ? 'Host · ' : ''}{!m.online ? 'Offline' : m.ready ? t('Siap', 'Ready') : isLobby ? t('Di lobi', 'In the lobby') : `${m.count} ${t('kartu', 'cards')}`}</span></div>{m.ready && <span className="ready-check"><Icon name="check"/></span>}{host && m.id !== self.id && <button className="remove" aria-label={t('Keluarkan ', 'Remove ') + m.name} onClick={() => confirmAction('kick', m.id)} disabled={disabled}><Icon name="close"/></button>}</div> : <button key={i} className="seat vacant" onClick={copy}><span className="empty-avatar"><Icon name="plus"/></span><span>{isLobby ? t('Undang teman', 'Invite a friend') : t('Undang penonton', 'Invite spectator')}</span></button>; })}</div>
      {spectators.length > 0 && <div className="spectators"><span className="eyebrow">{t('PENONTON', 'WATCHING')} · {spectators.length}</span>{spectators.map(m => <div key={m.id}><span>{m.name}{m.id === self.id ? t(' (kamu)', ' (you)') : ''}</span>{host && <button className="remove" aria-label={t('Keluarkan ', 'Remove ') + m.name} onClick={() => confirmAction('kick', m.id)}><Icon name="close"/></button>}</div>)}</div>}
      {isLobby && <section className="settings"><h3>{t('Saat koneksi terputus', 'When a player disconnects')}</h3><label className="field"><span className="sr-only">{t('Kebijakan koneksi', 'Connection policy')}</span><select disabled={!host || disabled} value={room.settings.disconnect} onChange={e => action({ type: 'settings', settings: { ...room.settings, disconnect: e.target.value as 'pause' | 'continue' } })}><option value="pause">{t('Jeda otomatis', 'Pause immediately')}</option><option value="continue">{t('Lanjut sementara', 'Continue temporarily')}</option></select></label>{room.settings.disconnect === 'continue' && <label className="field">{t('Batas waktu kembali', 'Time to reconnect')}<select value={room.settings.timeout} disabled={!host || disabled} onChange={e => action({ type: 'settings', settings: { ...room.settings, timeout: Number(e.target.value) as 30 | 60 | 120 } })}>{[30, 60, 120].map(n => <option key={n} value={n}>{n} {t('detik', 'seconds')}</option>)}</select></label>}<p className="muted">{t('Kartu pemain offline tetap diperhitungkan.', 'Offline players’ cards still count.')}</p></section>}
      <div className="roster-actions">{isLobby && <button className="text-button" disabled={disabled || !playing && participants.length >= 4} onClick={() => action({ type: 'seat' })}>{playing ? t('Jadi penonton', 'Watch instead') : t('Ikut bermain', 'Take a seat')}</button>}<button className="text-button" disabled={disabled} onClick={() => confirmAction('leave')}>{t('Keluar room', 'Leave room')} <Icon name="arrow"/></button></div>
    </aside></details>
    {confirmation && <ConfirmDialog title={confirmation.type === 'kick' ? t('Keluarkan ', 'Remove ') + selected.name + '?' : pendingLabel + '?'} message={confirmation.epoch !== room.epoch ? t('Kondisi meja sudah berubah. Tutup pesan ini dan periksa meja dulu.', 'The table has changed. Close this message and check the table first.') : confirmation.type === 'resume' ? t('Kartu pemain offline tetap dihitung. Tim bisa kehilangan nyawa meski mereka belum kembali.', 'Offline players’ cards still count. The team can lose lives before they return.') : interruptsGame(confirmation.type, selected.role, room.phase) ? t('Pertandingan ini akan dibatalkan. Pemain lain kembali ke lobi dan bisa mulai lagi.', 'This game will be cancelled. Everyone else returns to the lobby and can start again.') : confirmation.type === 'kick' ? t('Peserta ini akan dikeluarkan dari room. Permainan tetap berjalan.', 'This participant will leave the room. The game continues.') : confirmation.type === 'cancel' ? t('Semua peserta akan kembali ke lobi.', 'Everyone will return to the lobby.') : t('Kamu akan keluar dari room. Peserta lain tetap berada di meja.', 'You will leave the room. The others will stay at the table.')} confirmLabel={pendingLabel} cancelLabel={t('Batal', 'Cancel')} disabled={disabled || confirmation.epoch !== room.epoch} onClose={() => setConfirmation(null)} onConfirm={() => { action({ type: confirmation.type, target: confirmation.target }); setConfirmation(null); }}/>} 
  </main>;
}
const rootRoute = createRootRoute({ component: Shell });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home });
const roomRoute = createRoute({ getParentRoute: () => rootRoute, path: '/room/$code', component: RoomPage });
const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, roomRoute]), defaultNotFoundComponent: () => <main className="empty-state"><h1>404</h1><Link to="/">The Minds →</Link></main> });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
createRoot(document.getElementById('root')!).render(<Provider><RouterProvider router={router}/></Provider>);
