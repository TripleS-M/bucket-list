import { useEffect, useState } from 'react';

export const pad = (n, w = 4) => String(n).padStart(w, '0');
export const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);

export function Tick({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" strokeWidth="2.2" strokeLinecap="square">
      <path d="M2 6.5 5 9.5 10.5 3" />
    </svg>
  );
}

export function Segments({ done, total, n = 14 }) {
  const filled = total ? Math.round((done / total) * n) : 0;
  return (
    <div className="segs" aria-hidden>
      {Array.from({ length: n }, (_, i) => <i key={i} className={i < filled ? 'f' : ''} />)}
    </div>
  );
}

export function Avatar({ author }) {
  if (author.avatarUrl) return <img className="avatar" src={author.avatarUrl} alt="" referrerPolicy="no-referrer" />;
  return <span className="avatar">{author.name?.[0]?.toUpperCase()}</span>;
}

export function useClock() {
  const fmt = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const [t, setT] = useState(fmt);
  useEffect(() => { const id = setInterval(() => setT(fmt()), 15000); return () => clearInterval(id); }, []);
  return t;
}

export function Modal({ onClose, wide, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <button className="x tube" onClick={onClose} aria-label="Close">×</button>
        {children}
      </div>
    </div>
  );
}
