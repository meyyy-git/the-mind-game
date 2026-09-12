import { useEffect, useRef } from 'react';
import type { GameResult } from '../shared/types';

export function Icon({ name, className = '' }: { name: 'arrow' | 'copy' | 'check' | 'close' | 'sound' | 'mute' | 'help' | 'star' | 'heart' | 'plus' | 'eye' | 'eyeOff'; className?: string }) {
  const paths = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    sound: <><path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
    mute: <><path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2m0 3h.01"/></>,
    star: <><path d="m12 2 2 6 8 4-6 2-4 8-2-6-8-4 6-2 4-8Z"/><circle cx="12" cy="12" r="1.5"/></>,
    heart: <path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-5 5 3 12 8 15 5-3 13-10 8-15Z"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="m3 3 18 18M10 5h2c7 0 10 7 10 7a19 19 0 0 1-3 4M6 6a20 20 0 0 0-4 6s3 7 10 7c2 0 4-.6 5-1.5M10 10a3 3 0 0 0 4 4"/></>,
  };
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function InviteCode({ code, hidden, onToggle, t }: { code: string; hidden: boolean; onToggle: () => void; t: (id: string, en: string) => string }) {
  const label = hidden ? t('Tampilkan kode undangan', 'Show invite code') : t('Sembunyikan kode undangan', 'Hide invite code');
  return <span className="invite-code-group"><strong className="room-code" aria-label={hidden ? t('Kode undangan disembunyikan', 'Invite code hidden') : undefined}>{hidden ? '••••••' : code}</strong><button type="button" className="icon-button" onClick={onToggle} aria-label={label} title={label} aria-pressed={hidden}><Icon name={hidden ? 'eyeOff' : 'eye'}/></button></span>;
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onClose, disabled }: { title: string; message: string; confirmLabel: string; cancelLabel: string; onConfirm: () => void; onClose: () => void; disabled: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return <dialog ref={ref} className="confirm-dialog" onCancel={onClose} aria-labelledby="confirm-title" aria-describedby="confirm-description">
    <h2 id="confirm-title">{title}</h2><p id="confirm-description">{message}</p>
    <div className="dialog-actions"><button autoFocus className="secondary" onClick={onClose}>{cancelLabel}</button><button className="primary" disabled={disabled} onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}

export function interruptsGame(type: 'leave' | 'kick' | 'cancel' | 'resume', role: 'player' | 'spectator', phase: string) {
  return (type === 'cancel' || (type === 'leave' || type === 'kick') && role === 'player') && phase !== 'lobby' && phase !== 'finished';
}

export function ResultDialog({ result, t, onClose, isHost, onLobby }: { result: GameResult; t: (id: string, en: string) => string; onClose: () => void; isHost: boolean; onLobby: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const title = result.kind === 'mistake' ? t('Urutan kartu salah', 'Card out of order') : result.kind === 'lost' ? t('Nyawa habis', 'No lives left') : result.kind === 'won' ? t('Kalian menang!', 'You win!') : t('Level ', 'Level ') + result.level + t(' selesai!', ' complete!');
  const eyebrow = result.kind === 'mistake' ? t('KESALAHAN', 'MISTAKE') : result.kind === 'level' ? t(`LEVEL ${result.level} SELESAI`, `LEVEL ${result.level} COMPLETE`) : result.kind === 'won' ? t('PERMAINAN SELESAI', 'GAME COMPLETE') : t('PERMAINAN BERAKHIR', 'GAME OVER');
  return <dialog ref={ref} className={`result-dialog result-${result.kind}`} aria-labelledby="result-title" aria-describedby="result-description" onCancel={onClose}>
    <div className="result-emblem" aria-hidden="true"><Icon name={result.kind === 'lost' || result.kind === 'mistake' ? 'heart' : result.kind === 'won' ? 'star' : 'check'}/></div>
    <span className="result-eyebrow">{eyebrow}</span><h2 id="result-title">{title}</h2>
    <p id="result-description">{result.kind === 'mistake' ? t('Ada kartu lebih rendah yang belum dimainkan. Tim kehilangan satu nyawa. Tutup popup, lalu tekan Siap untuk melanjutkan.', 'Lower cards were still in hand. The team loses one life. Close this popup, then press Ready to continue.') : result.kind === 'level' ? t('Berikutnya, level ', 'Next up, level ') + (result.level + 1) + t('. Tutup hasil ini untuk melihat kartumu, lalu tekan Siap.', '. Close this result to see your cards, then press Ready.') : result.kind === 'won' ? t('Tim menyelesaikan semua ', 'Your team completed all ') + result.level + t(' level.', ' levels.') : t('Permainan berakhir di level ', 'The game ended at level ') + result.level + '.'}</p>
    {!!result.missedCards?.length && <div className="revealed"><span>{t('Kartu yang terlewat', 'Missed cards')}</span><div>{result.missedCards.map(card => <span key={card}>{card}</span>)}</div></div>}
    {result.kind === 'mistake' && <p className="result-penalty"><Icon name="heart"/>−1 {t('nyawa', 'life')}</p>}
    {(result.reward.lives > 0 || result.reward.stars > 0) && <p className="result-reward"><Icon name={result.reward.lives ? 'heart' : 'star'}/>{result.reward.lives ? '+1 ' + t('nyawa', 'life') : '+1 shuriken'}</p>}
    <dl className="result-inventory"><div><dt>{t('Sisa nyawa', 'Lives left')}</dt><dd><Icon name="heart"/>{result.lives}</dd></div><div><dt>{t('Sisa shuriken', 'Shuriken left')}</dt><dd><Icon name="star"/>{result.stars}</dd></div></dl>
    {(result.kind === 'won' || result.kind === 'lost') && <dl className="match-summary"><div><dt>{t('Kesalahan', 'Mistakes')}</dt><dd>{result.mistakes}</dd></div><div><dt>{t('Shuriken dipakai', 'Shuriken used')}</dt><dd>{result.shurikensUsed}</dd></div></dl>}
    <button autoFocus className="primary full" onClick={onClose}>{result.kind === 'level' || result.kind === 'mistake' ? t('Lanjut', 'Continue') : t('Tutup hasil', 'Close result')}<Icon name="arrow"/></button>
    {(result.kind === 'lost' || result.kind === 'won') && isHost ? <button className="secondary full result-lobby" onClick={() => { onClose(); onLobby(); }}>{t('Kembali ke lobi', 'Back to lobby')}<Icon name="arrow"/></button> : <p className="result-note">{result.kind === 'lost' || result.kind === 'won' ? t('Setelah semua selesai membaca, host dapat kembali ke lobi.', 'Once everyone has read the result, the host can return to the lobby.') : t('Pemain lain tetap melihat hasilnya di layar masing-masing.', 'Other players see the result on their own screen.')}</p>}
  </dialog>;
}
