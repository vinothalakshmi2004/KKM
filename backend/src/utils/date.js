import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { env } from '../config/env.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const TZ = env.tz;

export const nowTz = () => dayjs().tz(TZ);

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
const LOCAL_ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?)?$/;

/**
 * Parse a date input. Strings with an offset ("…Z", "…+05:30") keep it. Strings without one
 * ("2026-10-20", "2026-10-20T12:00") are wall-clock time in the hotel timezone, never the
 * server's own timezone.
 */
export const parseDate = (value) => {
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (HAS_OFFSET.test(s)) return new Date(s);
  if (LOCAL_ISO.test(s)) return dayjs.tz(s.replace(' ', 'T'), TZ).toDate();
  return new Date(NaN);
};

export const startOfDay = (value) => dayjs(parseDate(value)).tz(TZ).startOf('day').toDate();
export const endOfDay = (value) => dayjs(parseDate(value)).tz(TZ).endOf('day').toDate();

/** Nights = calendar days between check-in and check-out dates (hotel timezone), minimum 1. */
export const nightsBetween = (checkIn, checkOut) => {
  const a = dayjs(checkIn).tz(TZ).startOf('day');
  const b = dayjs(checkOut).tz(TZ).startOf('day');
  return Math.max(1, b.diff(a, 'day'));
};

/** Inclusive day range for report filters; defaults to the current month. */
export const resolveRange = (from, to) => {
  const start = from ? startOfDay(from) : nowTz().startOf('month').toDate();
  const end = to ? endOfDay(to) : nowTz().endOf('month').toDate();
  return { start, end };
};

export const todayRange = () => ({
  start: nowTz().startOf('day').toDate(),
  end: nowTz().endOf('day').toDate(),
});

export { dayjs };
