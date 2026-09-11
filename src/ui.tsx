import { useEffect, useRef } from 'react';

export function Icon({ name, className = '' }: { name: 'arrow' | 'copy' | 'check' | 'close' | 'sound' | 'mute' | 'help' | 'star' | 'heart' | 'plus'; className?: string }) {
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
  };
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
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
