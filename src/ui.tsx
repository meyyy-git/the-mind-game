import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, CaretDown, Check, Copy, Eye, EyeSlash, Heart, Plus, Question, SpeakerHigh, SpeakerSlash, StarFour, Users, X, type IconWeight } from '@phosphor-icons/react';
import type { GameResult } from '../shared/types';

const icons = { arrow: ArrowRight, copy: Copy, check: Check, close: X, sound: SpeakerHigh, mute: SpeakerSlash, help: Question, star: StarFour, heart: Heart, plus: Plus, eye: Eye, eyeOff: EyeSlash, chevronDown: CaretDown, users: Users };
export function Icon({ name, className = '', weight = 'bold' }: { name: keyof typeof icons; className?: string; weight?: IconWeight }) {
  const Glyph = icons[name];
  return <Glyph className={`ui-icon ${className}`} weight={weight} aria-hidden="true"/>;
}

/** A face-up card. Its tint runs from cool (1) to warm (100), so the number's place in the deck reads at a glance. */
export function Card({ value, className = '', style, children }: { value: number | null; className?: string; style?: CSSProperties; children?: ReactNode }) {
  if (value === null) return <span className={`card card-back ${className}`} style={style} aria-hidden="true"><Mark/></span>;
  return <span className={`card ${className}`} style={{ '--heat': (value - 1) / 99, ...style } as CSSProperties} aria-hidden="true">
    <span className="card-index">{value}</span><strong>{value}</strong><span className="card-index card-index-end">{value}</span>{children}
  </span>;
}

/** Logo: two card outlines, the hidden one cool and the played one warm. The front card is filled with --mark-bg so it covers the back one. */
export function Mark({ className = '' }: { className?: string }) {
  return <svg className={'mark ' + className} viewBox="8 8 48 49" fill="none" strokeWidth="3.5" aria-hidden="true">
    <rect x="14" y="16" width="26" height="36" rx="5" stroke="var(--card-cool)" transform="rotate(-14 27 34)"/>
    <rect x="25" y="15" width="26" height="36" rx="5" stroke="var(--ember)" fill="var(--mark-bg, var(--bg))" transform="rotate(9 38 33)"/>
  </svg>;
}

export function Wordmark() {
  return <span className="wordmark"><Mark/>the minds</span>;
}

export function maskInviteCode(code: string) {
  return code.length > 2 ? '•'.repeat(code.length - 2) + code.slice(-2) : code;
}

export function InviteCode({ code, hidden, onToggle, t }: { code: string; hidden: boolean; onToggle: () => void; t: (id: string, en: string) => string }) {
  const label = hidden ? t('Tampilkan kode undangan', 'Show invite code') : t('Sembunyikan kode undangan', 'Hide invite code');
  return <span className="invite-code-group"><strong className="room-code" aria-label={hidden ? t('Kode undangan disembunyikan', 'Invite code hidden') : undefined}>{hidden ? '••••••' : code}</strong><button type="button" className="icon-button ghost" onClick={onToggle} aria-label={label} title={label} aria-pressed={hidden}><Icon name={hidden ? 'eyeOff' : 'eye'}/></button></span>;
}

export function useModal(ref: React.RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onClose, disabled }: { title: string; message: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onClose: () => void; disabled: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref);
  return <dialog ref={ref} className="sheet confirm-dialog" onCancel={onClose} aria-labelledby="confirm-title" aria-describedby="confirm-description">
    <h2 id="confirm-title">{title}</h2><p id="confirm-description">{message}</p>
    <div className="dialog-actions"><button autoFocus className="secondary" onClick={onClose}>{cancelLabel}</button><button className="primary" disabled={disabled} onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}

export function interruptsGame(type: 'leave' | 'kick' | 'cancel' | 'resume', role: 'player' | 'spectator', phase: string) {
  return (type === 'cancel' || (type === 'leave' || type === 'kick') && role === 'player') && phase !== 'lobby' && phase !== 'finished';
}

export function ResultDialog({ result, t, onClose, isHost, onLobby }: { result: GameResult; t: (id: string, en: string) => string; onClose: () => void; isHost: boolean; onLobby: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref);
  const bad = result.kind === 'lost' || result.kind === 'mistake';
  const title = result.kind === 'mistake' ? t('Urutan kartu salah', 'Card out of order') : result.kind === 'lost' ? t('Nyawa habis', 'No lives left') : result.kind === 'won' ? t('Kalian menang!', 'You win!') : t('Level ', 'Level ') + result.level + t(' selesai!', ' complete!');
  return <dialog ref={ref} className={`sheet result-dialog result-${result.kind}`} aria-labelledby="result-title" aria-describedby="result-description" onCancel={onClose}>
    <div className="result-emblem" aria-hidden="true"><Icon name={bad ? 'heart' : result.kind === 'won' ? 'star' : 'check'} weight={bad ? 'regular' : result.kind === 'won' ? 'fill' : 'bold'}/></div>
    <h2 id="result-title">{title}</h2>
    <p id="result-description">{result.kind === 'mistake' ? t('Ada kartu lebih rendah yang belum dimainkan. Tim kehilangan satu nyawa dan level ini dibagikan ulang.', 'Lower cards were still in hand. The team loses one life and this level is dealt again.') : result.kind === 'level' ? t('Berikutnya, level ', 'Next up, level ') + (result.level + 1) + t('. Tutup hasil ini untuk melihat kartumu, lalu tekan Siap.', '. Close this result to see your cards, then press Ready.') : result.kind === 'won' ? t('Tim menyelesaikan semua ', 'Your team completed all ') + result.level + t(' level.', ' levels.') : t('Permainan berakhir di level ', 'The game ended at level ') + result.level + '.'}</p>
    {!!result.missedCards?.length && <div className="missed"><span>{t('Kartu yang terlewat', 'Missed cards')}</span><div>{result.missedCards.map(card => <Card key={card} value={card} className="card-xs"/>)}</div></div>}
    {result.kind === 'mistake' && <p className="result-delta is-bad"><Icon name="heart" weight="fill"/>−1 {t('nyawa', 'life')}</p>}
    {(result.reward.lives > 0 || result.reward.stars > 0) && <p className="result-delta"><Icon name={result.reward.lives ? 'heart' : 'star'} weight="fill"/>{result.reward.lives ? '+1 ' + t('nyawa', 'life') : '+1 shuriken'}</p>}
    <dl className="result-stats">
      <div><dt>{t('Sisa nyawa', 'Lives left')}</dt><dd><Icon name="heart" weight="fill"/>{result.lives}</dd></div>
      <div><dt>{t('Sisa shuriken', 'Shuriken left')}</dt><dd><Icon name="star" weight="fill"/>{result.stars}</dd></div>
      {(result.kind === 'won' || result.kind === 'lost') && <><div><dt>{t('Kesalahan', 'Mistakes')}</dt><dd>{result.mistakes}</dd></div><div><dt>{t('Shuriken dipakai', 'Shuriken used')}</dt><dd>{result.shurikensUsed}</dd></div></>}
    </dl>
    <button autoFocus className="primary full" onClick={onClose}>{result.kind === 'level' || result.kind === 'mistake' ? t('Lanjut', 'Continue') : t('Tutup hasil', 'Close result')}<Icon name="arrow"/></button>
    {(result.kind === 'lost' || result.kind === 'won') && isHost ? <button className="secondary full result-lobby" onClick={() => { onClose(); onLobby(); }}>{t('Kembali ke lobi', 'Back to lobby')}</button> : <p className="result-note">{result.kind === 'lost' || result.kind === 'won' ? t('Setelah semua selesai membaca, host dapat kembali ke lobi.', 'Once everyone has read the result, the host can return to the lobby.') : t('Pemain lain tetap melihat hasilnya di layar masing-masing.', 'Other players see the result on their own screen.')}</p>}
  </dialog>;
}
