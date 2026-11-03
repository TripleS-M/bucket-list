import { useEffect, useLayoutEffect, useRef } from 'react';

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

// Single-line-semantics textarea that grows to fit wrapped text; Enter commits (blur).
export function AutoText({ inputRef, onKeyDown, onInput, ...props }) {
  const own = useRef(null);
  const ref = inputRef || own;
  const fit = () => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
  useLayoutEffect(fit);
  useEffect(() => { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); });
  return (
    <textarea ref={ref} rows={1} {...props}
      onInput={(e) => { fit(); onInput?.(e); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } onKeyDown?.(e); }} />
  );
}

export function Avatar({ author }) {
  if (author.avatarUrl) return <img className="avatar" src={author.avatarUrl} alt="" referrerPolicy="no-referrer" />;
  return <span className="avatar">{author.name?.[0]?.toUpperCase()}</span>;
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
