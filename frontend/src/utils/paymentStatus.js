/**
 * Booking payment state from its amounts (existing badge colours):
 * Fully paid = green, Partly paid = yellow, Not paid = red. Cancelled bookings have none.
 */
export function bookingPayment(b) {
  if (!b || b.status === 'Cancelled') return null;
  const total = Number(b.grandTotal) || 0;
  const paid = Number(b.paidAmount) || 0;
  if (total > 0 && paid >= total - 0.005) return { label: 'Fully paid', badge: 'badge-green' };
  if (paid > 0) return { label: 'Partly paid', badge: 'badge-yellow' };
  return { label: 'Not paid', badge: 'badge-red' };
}

/**
 * Income row tag from the payment note: "Paid in full" = green, "Advance" = yellow,
 * "Settlement" = blue. Any other note is shown as plain text.
 */
export function paymentKind(note = '') {
  if (/full/i.test(note)) return { label: 'Paid in full', badge: 'badge-green' };
  if (/advance/i.test(note)) return { label: 'Advance', badge: 'badge-yellow' };
  if (/settle/i.test(note)) return { label: 'Settlement', badge: 'badge-blue' };
  return null;
}
