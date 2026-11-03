import { useEffect } from 'react';
import { useToastStore, type Toast } from '@/stores';

const AUTO_DISMISS_MS = 5000;

const kindStyles: Record<Toast['kind'], string> = {
  success: 'border-success text-success',
  error: 'border-danger text-danger',
  info: 'border-accent-400 text-accent-400',
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-md border bg-ink-800 px-4 py-3 text-sm shadow-lg ${kindStyles[toast.kind]}`}
    >
      <span className="flex-1 text-parchment-100">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="text-parchment-400 hover:text-parchment-50"
        onClick={() => dismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
}

/** Fixed, aria-live container rendering the toast queue from `useToastStore`. */
export default function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 [&>*]:pointer-events-auto"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
