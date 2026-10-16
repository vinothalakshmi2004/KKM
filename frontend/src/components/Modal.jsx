import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

/**
 * Centred dialog rendered into <body>, so page animations or scroll containers can't clip it.
 * Header and footer stay put; only the body scrolls. Esc / backdrop click close it.
 *
 * Wrap the body + footer in a <form> by passing `as="form"` and `onSubmit`.
 */
export default function Modal({
  title,
  subtitle,
  icon: Icon,
  size = 'lg',
  onClose,
  footer,
  children,
  as: Tag = 'div',
  onSubmit,
  busy = false,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose?.();
    document.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, busy]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-ink-900/60 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <Tag
        onSubmit={onSubmit}
        className={`animate-modal-in w-full ${SIZES[size] || SIZES.lg} max-h-[92vh] flex flex-col bg-white dark:bg-ink-800 shadow-2xl rounded-t-2xl sm:rounded-2xl border border-ink-200 dark:border-ink-700`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-ink-100 dark:border-ink-700 flex-shrink-0">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-ink-900 dark:text-white leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 -m-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-100 dark:hover:bg-ink-700 dark:hover:text-ink-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer (always visible) */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink-100 dark:border-ink-700 bg-ink-50/70 dark:bg-ink-800/80 rounded-b-2xl flex-shrink-0">
            {footer}
          </div>
        )}
      </Tag>
    </div>,
    document.body
  );
}

/** Small section heading used inside modal forms. */
export function ModalSection({ title, hint, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{title}</h3>
        {hint && <p className="text-xs text-ink-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
