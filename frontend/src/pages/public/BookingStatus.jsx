import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, BedDouble, CalendarDays, MessageCircle, AlertTriangle } from 'lucide-react';
import PublicShell, { PublicCard } from '../../components/booking/PublicShell';
import { getPublicBookingStatus, dataOf } from '../../api/services';
import { fullAddress, waLink } from '../../components/landing/siteUtils';
import { formatINR } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';

const STATUS_BADGE = {
  Booked: 'badge-blue',
  'Checked-in': 'badge-green',
  'Checked-out': 'badge-slate',
  Cancelled: 'badge-red',
};
const field = 'site-field [color-scheme:light]';

export default function BookingStatus() {
  const [form, setForm] = useState({ ref: '', phone: '' });
  const [formError, setFormError] = useState('');
  const lookup = useMutation({
    mutationFn: () => getPublicBookingStatus({ ref: form.ref.trim().toUpperCase(), phone: form.phone.replace(/\D/g, '') }).then(dataOf),
  });

  const submit = (e) => {
    e.preventDefault();
    const ref = form.ref.trim().toUpperCase();
    const digits = form.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (!/^OB-\d{4}-\d{4,}$/.test(ref)) return setFormError('Enter the booking reference, e.g. OB-2026-0001');
    if (!/^\d{10}$/.test(digits)) return setFormError('Enter the 10-digit mobile number used for booking');
    setFormError('');
    lookup.mutate();
  };

  const b = lookup.data;
  const error = formError || (lookup.error && (lookup.error.response?.data?.message || 'Could not check the booking. Please try again.'));

  return (
    <PublicShell title="Booking status">
      <h1 className="font-display text-3xl sm:text-4xl text-ink">Check your booking</h1>
      <p className="text-ink-soft mt-2 mb-6">Enter the reference from your confirmation and your mobile number.</p>

      <PublicCard>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
          <label>
            <span className="site-label">Booking reference</span>
            <input className={`${field} uppercase`} value={form.ref} onChange={(e) => setForm((f) => ({ ...f, ref: e.target.value }))} placeholder="OB-2026-0001" autoComplete="off" maxLength={20} />
          </label>
          <label>
            <span className="site-label">Mobile number</span>
            <input className={field} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile" inputMode="tel" autoComplete="tel" maxLength={16} />
          </label>
          <button type="submit" className="btn-gold" disabled={lookup.isPending}>
            <Search className="w-4 h-4" /> {lookup.isPending ? 'Checking…' : 'Check status'}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
          </p>
        )}
      </PublicCard>

      {b && (
        <PublicCard className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-5 border-b border-cream-100">
            <div>
              <p className="font-display text-2xl text-ink">{b.onlineRef}</p>
              <p className="text-sm text-ink-soft">Booking no. <span className="font-semibold text-ink">{b.bookingNo}</span>{b.guestName ? ` · ${b.guestName}` : ''}</p>
              {b.hotel?.name && <p className="text-sm text-ink-soft mt-1">{b.hotel.name}{fullAddress(b.hotel) ? `, ${fullAddress(b.hotel)}` : ''}</p>}
            </div>
            <span className={`badge ${STATUS_BADGE[b.status] || 'badge-slate'}`}>{b.status}</span>
          </div>
          <div className="py-5 border-b border-cream-100">
            <p className="site-label">Room{b.rooms?.length === 1 ? '' : 's'}</p>
            <ul className="flex flex-wrap gap-3">
              {(b.rooms || []).map((r) => (
                <li key={r.roomNumber} className="rounded-2xl bg-night text-white px-4 py-2.5">
                  <p className="font-display text-2xl leading-tight flex items-center gap-2"><BedDouble className="w-4 h-4 text-gold-300" />{r.roomNumber}</p>
                  <p className="text-xs text-white/80">{r.type}</p>
                </li>
              ))}
            </ul>
          </div>
          <dl className="pt-5 grid gap-4 sm:grid-cols-2 text-sm">
            <div><dt className="text-ink-soft flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-in</dt><dd className="font-semibold text-ink">{formatDateTime(b.checkIn)}</dd></div>
            <div><dt className="text-ink-soft flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Check-out</dt><dd className="font-semibold text-ink">{formatDateTime(b.checkOut)}</dd></div>
            <div><dt className="text-ink-soft">Grand total</dt><dd className="font-semibold text-ink">{formatINR(b.grandTotal)}</dd></div>
            <div><dt className="text-ink-soft">Balance</dt><dd className="font-semibold text-ink">{formatINR(b.balance)} · {b.paymentStatus}</dd></div>
          </dl>
          {b.hotel?.whatsappNumber && (
            <a
              href={waLink(b.hotel.whatsappNumber, `Hi, about my booking ${b.onlineRef} (${b.bookingNo}).`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline-ink mt-6"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp the hotel
            </a>
          )}
        </PublicCard>
      )}
    </PublicShell>
  );
}
