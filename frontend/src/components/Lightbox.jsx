import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Full-screen image viewer: arrows / keyboard / swipe to move (wraps around), Esc to close.
 * `images`: array of URLs; `captions`: optional array of strings.
 */
export default function Lightbox({ images, captions = [], startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex);
  const touchStart = useRef(null);
  const count = images.length;

  const prev = useCallback(() => setCurrent((c) => (c - 1 + count) % count), [count]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % count), [count]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = overflow;
    };
  }, [next, prev, onClose]);

  const onTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    // Horizontal swipe of at least 50px
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors z-10"
        aria-label="Close"
      >
        <X className="w-7 h-7" />
      </button>

      {count > 1 && (
        <button
          onClick={prev}
          className="absolute left-2 sm:left-4 w-12 h-12 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors z-10"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-9 h-9" />
        </button>
      )}

      <figure className="max-w-6xl w-full mx-4 sm:mx-20 flex flex-col items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <img
          key={current}
          src={images[current]}
          alt={captions[current] || `Image ${current + 1}`}
          className="animate-modal-in max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          draggable={false}
        />
        {captions[current] && <figcaption className="mt-4 text-sm text-white/85 text-center">{captions[current]}</figcaption>}
      </figure>

      {count > 1 && (
        <button
          onClick={next}
          className="absolute right-2 sm:right-4 w-12 h-12 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors z-10"
          aria-label="Next image"
        >
          <ChevronRight className="w-9 h-9" />
        </button>
      )}

      {count > 1 && count <= 20 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Image ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === current ? 'bg-white w-6' : 'bg-white/40 w-2'}`}
            />
          ))}
        </div>
      )}

      <div className="absolute top-5 left-5 text-white/70 text-sm">
        {current + 1} / {count}
      </div>
    </div>,
    document.body
  );
}
