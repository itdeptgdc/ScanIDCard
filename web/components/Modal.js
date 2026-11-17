'use client';
import { useEffect } from 'react';

export default function Modal({ open, onClose, children, width = 720, className = '' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${className}`} style={{ maxWidth: width }} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel, cancelLabel, onConfirm, onClose, busy }) {
  return (
    <Modal open={open} onClose={onClose} width={440}>
      <h3 className="modal-title">{title}</h3>
      <p className="muted" style={{ margin: '8px 0 22px', lineHeight: 1.6 }}>{message}</p>
      <div className="modal-actions">
        <button className="btn btn-soft" onClick={onClose}>{cancelLabel}</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
