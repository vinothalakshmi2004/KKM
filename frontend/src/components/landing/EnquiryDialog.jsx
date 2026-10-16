import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageCircle } from 'lucide-react';
import EnquiryForm from './EnquiryForm';

/** "Book Now" dialog: the WhatsApp enquiry form, pre-filled from the search or room card. */
export default function EnquiryDialog({ open, onClose, hotels, prefill }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const hotel = prefill?.hotelSlug ? hotels.find((h) => h.slug === prefill.hotelSlug) : hotels.length === 1 ? hotels[0] : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-night/70 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Booking enquiry"
    >
      <div className="animate-modal-in w-full max-w-xl max-h-[94vh] flex flex-col bg-cream rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="relative bg-night px-6 py-5 text-white">
          <p className="text-[11px] tracking-[0.25em] uppercase text-gold-300">Booking enquiry</p>
          <h2 className="font-display text-2xl mt-1">{hotel ? hotel.name : 'Plan your stay'}</h2>
          <p className="text-sm text-white/75 mt-1 flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" /> Send your dates. We reply on WhatsApp.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6">
          <EnquiryForm hotels={hotels} prefill={prefill} onDone={onClose} />
        </div>
      </div>
    </div>,
    document.body
  );
}
