/**
 * Normalise Indian phone numbers to +91XXXXXXXXXX.
 * "98765 43210", "098765-43210", "919876543210" and "+91 98765 43210" all become "+919876543210".
 * Anything else (foreign numbers) is kept as digits with a leading + if one was given.
 */
export function normalizePhone(input) {
  if (input == null) return input;
  const raw = String(input).trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return raw.startsWith('+') ? `+${digits}` : digits;
}
