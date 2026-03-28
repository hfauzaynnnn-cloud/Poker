import React, { useState, useEffect, useRef } from 'react';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

const ICONS: Record<ToastType, string> = {
  error:   '⚠️',
  success: '✅',
  info:    'ℹ️',
  warning: '🔔',
};

const COLORS: Record<ToastType, { bg: string; border: string; bar: string }> = {
  error:   { bg: 'rgba(127,29,29,0.95)',  border: 'rgba(239,68,68,0.5)',   bar: '#ef4444' },
  success: { bg: 'rgba(6,78,59,0.95)',    border: 'rgba(34,197,94,0.5)',   bar: '#22c55e' },
  info:    { bg: 'rgba(23,37,84,0.95)',   border: 'rgba(99,102,241,0.5)',  bar: '#6366f1' },
  warning: { bg: 'rgba(120,53,15,0.95)',  border: 'rgba(245,158,11,0.5)',  bar: '#f59e0b' },
};

const ToastItemComponent: React.FC<{
  toast: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const [exiting, setExiting] = useState(false);
  const duration = toast.duration ?? 3500;
  const colors = COLORS[toast.type];

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 250);
  };

  useEffect(() => {
    const t = setTimeout(dismiss, duration);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={exiting ? 'toast-exit' : 'toast-enter'}
      style={{
        position: 'relative',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '10px 40px 10px 14px',
        minWidth: '260px',
        maxWidth: '340px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        backdropFilter: 'blur(16px)',
        cursor: 'pointer',
      }}
      onClick={dismiss}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '16px', lineHeight: 1.4, flexShrink: 0 }}>{ICONS[toast.type]}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.4, color: '#f1f5f9' }}>{toast.message}</span>
      </div>
      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, height: '2px',
        background: colors.bar, borderRadius: '0 0 12px 12px',
        animation: `actionTick ${duration}ms linear forwards`,
        width: '100%',
      }} />
      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        style={{
          position: 'absolute', top: '8px', right: '10px',
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          fontSize: '16px', cursor: 'pointer', padding: '0', lineHeight: 1,
        }}
      >✕</button>
    </div>
  );
};

// ── Toast context / singleton ────────────────────────────────────────────────

type ToastFn = (message: string, type?: ToastType, duration?: number) => void;

let _addToast: ToastFn = () => {};
export const toast: ToastFn = (message, type = 'info', duration) => _addToast(message, type, duration);
export const toastError   = (msg: string) => toast(msg, 'error');
export const toastSuccess = (msg: string) => toast(msg, 'success');
export const toastInfo    = (msg: string) => toast(msg, 'info');
export const toastWarning = (msg: string) => toast(msg, 'warning');

// ── Provider ─────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const addToast: ToastFn = (message, type = 'info', duration) => {
    const id = `t${++counterRef.current}`;
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Register singleton
  useEffect(() => { _addToast = addToast; }, []);

  return (
    <>
      {children}
      <div style={{
        position: 'fixed', top: '16px', right: '16px',
        zIndex: 'var(--toast-z)' as any,
        display: 'flex', flexDirection: 'column', gap: '8px',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItemComponent toast={t} onDismiss={removeToast} />
          </div>
        ))}
      </div>
    </>
  );
};

export default ToastProvider;
