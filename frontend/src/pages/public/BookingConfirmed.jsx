import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, BedDouble, CalendarDays, MapPin, Navigation, MessageCircle, Phone, Search, Info, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import PublicShell, { PublicCard } from '../../components/booking/PublicShell';
import { directionsUrl, fullAddress, telLink, waLink } from '../../components/landing/siteUtils';
import { formatINR } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';

const STORAGE_KEY = 'kkm:lastOnlineBooking';

function readStored() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export default function BookingConfirmed() {
  const { state } = useLocation();
  // After a refresh the router state is gone; the last booking is kept for this tab
  const b = useMemo(() => state?.booking || readStored(), [state]);

  if (!b) {
    return (
      <PublicShell title="Booking">
        <PublicCard className="text-center">
          <p className="font-display text-2xl text-ink">Looking for your booking?</p>
          <p className="text-ink-soft mt-2">Use your booking reference and phone number to see its status.</p>
          <Link to="/booking-status" className="btn-gold mt-6"><Search className="w-4 h-4" /> Check booking status</Link>
        </PublicCard>
      </PublicShell>
    );
  }

  const hotel = b.hotel || {};
  const address = fullAddress(hotel);
  const rooms = b.rooms?.length ? b.rooms : (b.roomNumbers || []).map((n) => ({ roomNumber: n }));
  const waText =
    `Hi ${hotel.name || ''}, I have booked online.\n` +
    `Reference: ${b.onlineRef}\nBooking no: ${b.bookingNo}\nName: ${b.guestName || ''}\n` +
    `Room: ${(b.roomNumbers || []).join(', ')}\nCheck-in: ${formatDateTime(b.checkIn)}\nCheck-out: ${formatDateTime(b.checkOut)}`;
  const wa = waLink(hotel.whatsappNumber, waText);

  const copyRef = () => {
    navigator.clipboard?.writeText(b.onlineRef).then(() => toast.success('Reference copied'), () => {});
  };

  return (
    <PublicShell title={hotel.name || 'Booking'} backTo={hotel.slug ? `/hotel/${hotel.slug}` : '/'} backLabel="Hotel page">
      <div className="text-center mb-6">
        <span className="inline-flex w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center">
          <CheckCircle2 className="w-9 h-9" />
        </span>
        <h1 className="font-display text-3xl sm:text-4xl text-ink mt-4">Booking Confirmed</h1>
        <p className="text-ink-soft mt-2">Your room is reserved. Show this reference at the hotel.</p>
      </div>

      {!b.paymentEnabled && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-cream-100 bg-cream px-4 py-3 text-sm text-ink mb-5">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-gold-600" />
          <p><span className="font-semibold">Online payment will be available soon.</span> Please pay at the hotel.</p>
        </div>
      )}

      <PublicCard>
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-cream-100">
          <div>
            <p className="site-label !mb-1">Booking reference</p>
            <button type="button" onClick={copyRef} className="font-display text-3xl text-ink inline-flex items-center gap-2 hover:text-gold-600" title="Copy reference">
              {b.onlineRef} <Copy className="w-4 h-4" />
            </button>
            <p className="text-sm text-ink-soft mt-1">Booking no. <span className="font-semibold text-ink">{b.bookingNo}</span></p>
          </div>
          <span className="badge badge-blue">{b.status || 'Booked'}</span>
        </div>

        <div className="py-5 border-b border-cream-100">
          <p className="site-label">Your room{rooms.length === 1 ? '' : 's'}</p>
          <ul className="flex flex-wrap gap-3">
            {rooms.map((r) => (
              <li key={r.roomNumber} className="rounded-2xl bg-night text-white px-5 py-3 min-w-[7rem]">
                <p className="text-[11px] tracking-[0.2em] uppercase text-gold-300 flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> Room</p>
                <p className="font-display text-3xl leading-tight">{r.roomNumber}</p>
                {r.type && <p className="text-xs text-white/80">{r.type}</p>}
              </li>
            ))}
          </ul>
        </div>

        <dl className="py-5 grid gap-4 sm:grid-cols-2 text-sm border-b border-cream-100">
          <div><dt className="text-ink-soft flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-in</dt><dd className="font-semibold text-ink mt-0.5">{formatDateTime(b.checkIn)}</dd></div>
          <div><dt className="text-ink-soft flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-out</dt><dd className="font-semibold text-ink mt-0.5">{formatDateTime(b.checkOut)}</dd></div>
          {b.pricing?.nights && <div><dt className="text-ink-soft">Nights</dt><dd className="font-semibold text-ink mt-0.5">{b.pricing.nights}</dd></div>}
          {b.guestName && <div><dt className="text-ink-soft">Guest</dt><dd className="font-semibold text-ink mt-0.5">{b.guestName}</dd></div>}
        </dl>

        <div className="py-5 space-y-2 text-sm">
          {b.pricing?.gstPercent > 0 && (
            <>
              <div className="flex justify-between text-ink"><span>Room charges</span><span>{formatINR(b.pricing.roomTotal)}</span></div>
              <div className="flex justify-between text-ink-soft"><span>GST ({b.pricing.gstPercent}%)</span><span>{formatINR(b.pricing.gstAmount)}</span></div>
            </>
          )}
          <div className="flex justify-between items-baseline">
            <span className="font-semibold text-ink">Total</span>
            <span className="font-display text-3xl text-ink">{formatINR(b.pricing?.grandTotal)}</span>
          </div>
          <div className="flex justify-between text-ink">
            <span>Payment</span>
            <span className="font-semibold">{b.payment?.paymentStatus || 'Pay at hotel'}</span>
          </div>
        </div>
      </PublicCard>

      <PublicCard className="mt-5">
        <p className="font-display text-xl text-ink">{hotel.name}</p>
        {address && <p className="text-sm text-ink-soft mt-1 flex items-start gap-1.5"><MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />{address}</p>}
        <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-3">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-gold">
              <MessageCircle className="w-4 h-4" /> WhatsApp the hotel
            </a>
          )}
          {address && (
            <a href={directionsUrl(hotel)} target="_blank" rel="noopener noreferrer" className="btn-outline-ink">
              <Navigation className="w-4 h-4" /> Open in Maps
            </a>
          )}
          {hotel.phone && (
            <a href={telLink(hotel.phone)} className="btn-outline-ink"><Phone className="w-4 h-4" /> Call</a>
          )}
        </div>
      </PublicCard>

      <p className="text-center text-sm text-ink-soft mt-6">
        Check this booking any time on the <Link to="/booking-status" className="text-gold-600 font-semibold hover:underline">booking status</Link> page.
      </p>
    </PublicShell>
  );
}
