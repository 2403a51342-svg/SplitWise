import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});

const KIND_BAR = {
  info: 'border-l-brand',
  success: 'border-l-pos',
  error: 'border-l-neg',
  live: 'border-l-accent',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /** toast('Saved', 'success') — kinds: info, success, error, live (a friend changed something) */
  const push = useCallback((text, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto max-w-sm rounded-xl border border-line border-l-4 bg-surface px-4 py-3 text-sm font-medium text-ink shadow-lg shadow-black/10 ${KIND_BAR[t.kind] || KIND_BAR.info}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
