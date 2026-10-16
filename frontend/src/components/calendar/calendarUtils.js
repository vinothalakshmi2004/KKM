import { dayjs, TZ } from '../../utils/date';

// Same badge classes as the booking list, so bars match the status badges in both themes
export const STATUS_BADGE = {
  Booked: 'badge-blue',
  'Checked-in': 'badge-green',
  'Checked-out': 'badge-slate',
  Cancelled: 'badge-red',
};
export const ACTIVE_STATUSES = ['Booked', 'Checked-in', 'Checked-out'];

/** Calendar day "YYYY-MM-DD" in the hotel timezone. */
export const istDay = (value) => dayjs(value).tz(TZ).format('YYYY-MM-DD');
export const todayIST = () => dayjs().tz(TZ).format('YYYY-MM-DD');
export const addDays = (ymd, n) => dayjs.tz(ymd, TZ).add(n, 'day').format('YYYY-MM-DD');
export const dayDiff = (a, b) => dayjs.tz(b, TZ).diff(dayjs.tz(a, TZ), 'day');

/** Nights a booking covers in the visible range: [start, end) as column indexes (may be <0 or >days). */
export function nightSpan(booking, fromYmd) {
  const start = dayDiff(fromYmd, istDay(booking.checkIn));
  const end = Math.max(dayDiff(fromYmd, istDay(booking.checkOut)), start + 1); // minimum one night
  return { start, end };
}

/** Case-insensitive match on guest name, phone digits, booking number or room number. */
export function matchesSearch(booking, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  const g = booking.guest || {};
  return (
    (g.name || '').toLowerCase().includes(q) ||
    (digits.length >= 3 && (g.phone || '').replace(/\D/g, '').includes(digits)) ||
    (booking.bookingNo || '').toLowerCase().includes(q) ||
    booking.rooms.some((r) => String(r.roomNumber).toLowerCase() === q)
  );
}
