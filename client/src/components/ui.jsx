import { useEffect, useId, useRef } from 'react';
import { CloseIcon } from './icons';

export function Avatar({ user, size = 36 }) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span
      className="inline-grid shrink-0 select-none place-items-center rounded-full font-display font-semibold text-white"
      style={{ width: size, height: size, background: user.color, fontSize: Math.round(size * 0.38) }}
      title={user.name}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ users, size = 28, max = 4 }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((u, i) => (
        <span
          key={u.id}
          className="rounded-full ring-2 ring-surface"
          style={{ marginLeft: i ? -size * 0.3 : 0 }}
        >
          <Avatar user={u} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="grid place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted ring-2 ring-surface"
          style={{ width: size, height: size, marginLeft: -size * 0.3 }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. Esc and backdrop click close it. */
export function Modal({ title, onClose, children, wide = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('input, select, textarea')?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-ink/50 backdrop-blur-sm sm:place-items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`sheet-in max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-7 ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
          <button type="button" className="btn btn-quiet -mr-2 -mt-1 !px-2" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Two-to-four way switch, e.g. Equally / Exact amounts / Percent. */
export function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex w-full rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Skeleton = ({ className = '' }) => <div className={`skeleton ${className}`} aria-hidden="true" />;

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-neg/10 px-3.5 py-2.5 text-sm font-medium text-neg">
      {children}
    </p>
  );
}
