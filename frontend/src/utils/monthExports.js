import { formatDate, formatDateTime } from './date';

/** Bookings + guest details (incl. full Aadhaar) for the monthly export. */
export function bookingRows(items) {
  const rows = [[
    'Booking No', 'Online Ref', 'Source', 'Status', 'Guest', 'Phone', 'Email', 'Address',
    'Aadhaar Number', 'ID Proof Type', 'ID Proof Number', 'Adults', 'Children', 'Total Guests', 'Rooms',
    'Check-in Date', 'Check-in Time', 'Check-out Date', 'Check-out Time', 'Nights',
    'Room Total', 'Extra Charges', 'Discount', 'GST %', 'GST Amount', 'Grand Total', 'Paid', 'Balance',
    'Payments', 'Booked On', 'Notes', 'Cancel Reason',
  ]];
  items.forEach((b) => {
    const g = b.guestId || {};
    const [inDate, inTime] = splitDateTime(b.checkIn);
    const [outDate, outTime] = splitDateTime(b.checkOut);
    rows.push([
      b.bookingNo, b.onlineRef || '', b.source, b.status,
      g.name || '', g.phone || '', g.email || '', g.address || '',
      g.aadhaar || '', g.idProofType || '', g.idProofNumber || '',
      b.adults ?? 1, b.children ?? 0, (b.adults ?? 1) + (b.children ?? 0),
      (b.rooms || []).map((r) => `${r.roomNumber} (${r.type}) @${r.ratePerNight}`).join('; '),
      inDate, inTime, outDate, outTime, b.nights,
      b.roomTotal, (b.extraCharges || []).map((x) => `${x.label} ${x.amount}`).join('; '), b.discount,
      b.gstPercent, b.gstAmount, b.grandTotal, b.paidAmount, b.balance,
      (b.payments || []).map((p) => `${formatDate(p.date)} ${p.mode} ${p.amount}${p.note ? ` (${p.note})` : ''}`).join('; '),
      formatDateTime(b.createdAt), b.notes || '', b.cancelReason || '',
    ]);
  });
  return rows;
}

export function incomeRows(items) {
  const rows = [['Date', 'Time', 'Amount', 'Mode', 'Note', 'Booking No', 'Guest', 'Phone']];
  items.forEach((p) => {
    const [d, t] = splitDateTime(p.date);
    rows.push([d, t, p.amount, p.mode, p.note || '', p.bookingNo || '', p.guestName || '', p.guestPhone || '']);
  });
  return rows;
}

export function expenseRows(items) {
  const rows = [['Date', 'Category', 'Paid To', 'Amount', 'Payment Mode', 'Note', 'Bills']];
  items.forEach((e) => rows.push([formatDate(e.date), e.categoryName, e.paidTo || '', e.amount, e.paymentMode, e.note || '', (e.bills || []).join('; ')]));
  return rows;
}

/** "18-Oct-2026 12:00 PM" → ["18-Oct-2026", "12:00 PM"] */
function splitDateTime(value) {
  const s = formatDateTime(value);
  const i = s.indexOf(' ');
  return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ''];
}
