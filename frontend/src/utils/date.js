import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);

export const TZ = 'Asia/Kolkata';

export const now = () => dayjs().tz(TZ);

export const toIST = (date) => dayjs(date).tz(TZ);

export const formatDate = (date) => {
  if (!date) return '—';
  return dayjs(date).tz(TZ).format('DD-MMM-YYYY');
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return dayjs(date).tz(TZ).format('DD-MMM-YYYY hh:mm A');
};

export const formatTime = (date) => {
  if (!date) return '—';
  return dayjs(date).tz(TZ).format('hh:mm A');
};

export const toInputDate = (date) => {
  if (!date) return '';
  return dayjs(date).tz(TZ).format('YYYY-MM-DD');
};

export const toInputDateTime = (date) => {
  if (!date) return '';
  return dayjs(date).tz(TZ).format('YYYY-MM-DDTHH:mm');
};

// Nights = calendar dates crossed, so 14-Oct 12:00 → 16-Oct 11:00 is 2 nights
export const diffNights = (checkIn, checkOut) => {
  const a = dayjs(checkIn).startOf('day');
  const b = dayjs(checkOut).startOf('day');
  const diff = b.diff(a, 'day');
  return diff < 1 ? 1 : diff;
};

// datetime-local input value (IST wall clock) → ISO string for the API
export const fromInputDateTime = (value) => {
  if (!value) return '';
  return dayjs.tz(value, 'YYYY-MM-DDTHH:mm', TZ).toISOString();
};

/** "14:30" → "2:30 PM" (hotel check-in/out times are stored as HH:mm) */
export const formatClock = (hhmm) => {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  return dayjs().hour(h).minute(m).format('h:mm A');
};

export { dayjs };
