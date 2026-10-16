import { withOptionalTransaction } from '../config/db.js';
import { deleteFiles } from '../config/gridfs.js';
import { Booking, Document, Enquiry, Expense, Guest, Payment } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { decryptAadhaar } from '../utils/aadhaar.js';
import { dayjs, nowTz, TZ } from '../utils/date.js';

/** Finished bookings only: stays still to come or in progress are never bulk-deleted. */
export const DELETABLE_STATUSES = ['Checked-out', 'Cancelled'];

/** "2026-09" → [start, end) in the hotel timezone. */
export function monthRange(month) {
  const start = dayjs.tz(`${month}-01`, TZ).startOf('month');
  const end = start.add(1, 'month');
  // Only months that are completely over can be deleted
  const deletable = !end.isAfter(nowTz().startOf('month'));
  return { start: start.toDate(), end: end.toDate(), deletable, label: start.format('MMMM YYYY') };
}

/**
 * The period to export / delete: one month ("2026-09"), a date range (from / to, inclusive
 * days in the hotel timezone) or all data. Deleting never reaches into the current month:
 * `lockFrom` is the start of this month, and records on or after it are always kept.
 */
export function resolvePeriod({ month, from, to, all }) {
  const lockFrom = nowTz().startOf('month').toDate();
  if (all) return { start: new Date(0), end: new Date(8.64e15), lockFrom, label: 'All data', key: 'all' };
  if (month) return { ...monthRange(month), lockFrom, key: month };
  const start = dayjs.tz(from, TZ).startOf('day');
  const end = dayjs.tz(to, TZ).add(1, 'day').startOf('day');
  if (!end.isAfter(start)) throw ApiError.badRequest('"To" date must be on or after the "From" date');
  return {
    start: start.toDate(),
    end: end.toDate(),
    lockFrom,
    label: `${start.format('DD-MMM-YYYY')} to ${end.subtract(1, 'day').format('DD-MMM-YYYY')}`,
    key: `${start.format('YYYY-MM-DD')}_to_${end.subtract(1, 'day').format('YYYY-MM-DD')}`,
  };
}

/** The part of the period that may be deleted (before the current month). */
const deletableWindow = (p) => ({ $gte: p.start, $lt: p.end < p.lockFrom ? p.end : p.lockFrom });
const inPeriod = (p) => ({ $gte: p.start, $lt: p.end });
const isBeforeLock = (p, date) => new Date(date) < p.lockFrom;

const fullAadhaar = (guest) => {
  if (!guest?.aadhaarEncrypted) return '';
  try {
    return decryptAadhaar(guest.aadhaarEncrypted).replace(/(\d{4})(?=\d)/g, '$1 ');
  } catch {
    return '';
  }
};

/** Delete Document records and, after the transaction, their stored files. */
async function removeDocuments(ownerType, ownerIds, session) {
  const docs = await Document.find({ ownerType, ownerId: { $in: ownerIds } }, { fileId: 1 }).session(session || null);
  await Document.deleteMany({ _id: { $in: docs.map((d) => d._id) } }, { session });
  return docs.map((d) => d.fileId);
}

const periodInfo = (p) => ({ period: p.key, label: p.label, deletable: p.start < p.lockFrom });

// ---------------------------------------------------------------- bookings + guests

/**
 * Bookings that checked in during the period, for the export: guest details including the
 * full Aadhaar number (the admin's own copy before deleting), party size, amounts and payments.
 */
export async function getPeriodBookings({ hotelId, ...query }) {
  const p = resolvePeriod(query);
  const bookings = await Booking.find({ hotelId, checkIn: inPeriod(p) })
    .populate('guestId', 'name phone email address idProofType idProofNumber aadhaarLast4 +aadhaarEncrypted')
    .sort({ checkIn: 1 })
    .lean();
  const payments = await Payment.find({ bookingId: { $in: bookings.map((b) => b._id) } }).sort({ date: 1 }).lean();
  const byBooking = new Map();
  for (const pay of payments) {
    const key = String(pay.bookingId);
    byBooking.set(key, [...(byBooking.get(key) || []), { amount: pay.amount, mode: pay.mode, date: pay.date, note: pay.note }]);
  }
  const deletableCount = bookings.filter((b) => DELETABLE_STATUSES.includes(b.status) && isBeforeLock(p, b.checkIn)).length;
  const activeCount = bookings.filter((b) => !DELETABLE_STATUSES.includes(b.status)).length;
  return {
    month: query.month,
    ...periodInfo(p),
    total: bookings.length,
    deletableCount,
    keptCount: bookings.length - deletableCount,
    activeCount,
    currentMonthCount: bookings.filter((b) => !isBeforeLock(p, b.checkIn)).length,
    items: bookings.map((b) => {
      const { aadhaarEncrypted, ...guest } = b.guestId || {};
      return { ...b, guestId: { ...guest, aadhaar: fullAadhaar(b.guestId) }, payments: byBooking.get(String(b._id)) || [] };
    }),
  };
}
export const getMonthBookings = getPeriodBookings;

/**
 * Delete the period's finished bookings (before this month) and the guest details behind them:
 * booking records, their uploaded ID files, and guest records (with Aadhaar) that have no other
 * booking left. Payments are KEPT so income and reports stay correct; each keeps the booking
 * number, guest name and phone. Expenses and invoices are not touched.
 */
export async function deletePeriodBookings({ hotelId, ...query }) {
  const p = resolvePeriod(query);
  if (p.start >= p.lockFrom) throw ApiError.badRequest('The current month cannot be deleted. Choose an earlier period.');
  const filter = { hotelId, checkIn: deletableWindow(p) };

  const result = await withOptionalTransaction(async (session) => {
    const rows = await Booking.find({ ...filter, status: { $in: DELETABLE_STATUSES } }, { bookingNo: 1, guestId: 1 })
      .populate('guestId', 'name phone')
      .session(session || null);
    const kept = await Booking.countDocuments({ hotelId, checkIn: inPeriod(p), _id: { $nin: rows.map((r) => r._id) } }).session(session || null);
    if (!rows.length) return { deleted: 0, guests: 0, documents: 0, paymentsKept: 0, kept, fileIds: [] };
    const ids = rows.map((r) => r._id);

    // Income stays: each payment keeps the booking number, guest name and phone before they go
    const paymentsKept = await Payment.countDocuments({ bookingId: { $in: ids } }).session(session || null);
    if (paymentsKept) {
      await Payment.bulkWrite(
        rows.map((r) => ({
          updateMany: {
            filter: { bookingId: r._id },
            update: { $set: { bookingNo: r.bookingNo, guestName: r.guestId?.name || '', guestPhone: r.guestId?.phone || '' } },
          },
        })),
        { session }
      );
    }

    const bookingFiles = await removeDocuments('booking', ids, session);
    const { deletedCount } = await Booking.deleteMany({ _id: { $in: ids } }, { session });
    await Enquiry.updateMany({ bookingId: { $in: ids } }, { $set: { bookingId: null } }, { session });

    // Guest details: guests of these bookings that now have no booking at all
    const guestIds = [...new Set(rows.map((r) => String(r.guestId?._id || r.guestId)))];
    const stillUsed = new Set((await Booking.distinct('guestId', { guestId: { $in: guestIds } }, { session: session || undefined })).map(String));
    const orphanGuests = guestIds.filter((g) => !stillUsed.has(g));
    const guestFiles = await removeDocuments('guest', orphanGuests, session);
    const guests = orphanGuests.length ? (await Guest.deleteMany({ _id: { $in: orphanGuests } }, { session })).deletedCount : 0;

    return {
      deleted: deletedCount,
      guests,
      documents: bookingFiles.length + guestFiles.length,
      paymentsKept,
      kept,
      fileIds: [...bookingFiles, ...guestFiles],
    };
  });

  // Stored files go only after the records are gone
  await deleteFiles(result.fileIds);
  const { fileIds, ...summary } = result;
  return { month: query.month, period: p.key, label: p.label, ...summary };
}
export const deleteMonthBookings = deletePeriodBookings;

// ---------------------------------------------------------------- income (payments)

/** Payments received in the period (by payment date). */
export async function getPeriodIncome({ hotelId, ...query }) {
  const p = resolvePeriod(query);
  const items = await Payment.find({ hotelId, date: inPeriod(p) })
    .populate({ path: 'bookingId', select: 'bookingNo guestId', populate: { path: 'guestId', select: 'name phone' } })
    .sort({ date: 1 })
    .lean();
  // Payments of bookings that still exist would change those bookings' balance, so they stay
  const deletableCount = items.filter((pay) => !pay.bookingId && isBeforeLock(p, pay.date)).length;
  return {
    ...periodInfo(p),
    total: items.length,
    amount: items.reduce((s, pay) => s + pay.amount, 0),
    deletableCount,
    keptCount: items.length - deletableCount,
    linkedCount: items.filter((pay) => pay.bookingId).length,
    currentMonthCount: items.filter((pay) => !isBeforeLock(p, pay.date)).length,
    items: items.map((pay) => ({
      ...pay,
      bookingNo: pay.bookingId?.bookingNo || pay.bookingNo || '',
      guestName: pay.bookingId?.guestId?.name || pay.guestName || '',
      guestPhone: pay.bookingId?.guestId?.phone || pay.guestPhone || '',
    })),
  };
}
export const getMonthIncome = getPeriodIncome;

/** Delete the period's payments (before this month) whose booking was already deleted. */
export async function deletePeriodIncome({ hotelId, ...query }) {
  const p = resolvePeriod(query);
  if (p.start >= p.lockFrom) throw ApiError.badRequest('The current month cannot be deleted. Choose an earlier period.');
  const payments = await Payment.find({ hotelId, date: deletableWindow(p) }, { bookingId: 1 });
  const existing = new Set((await Booking.distinct('_id', { _id: { $in: payments.map((pay) => pay.bookingId) } })).map(String));
  const ids = payments.filter((pay) => !existing.has(String(pay.bookingId))).map((pay) => pay._id);
  const { deletedCount } = ids.length ? await Payment.deleteMany({ _id: { $in: ids } }) : { deletedCount: 0 };
  const inRange = await Payment.countDocuments({ hotelId, date: inPeriod(p) });
  return { month: query.month, period: p.key, label: p.label, deleted: deletedCount, kept: inRange };
}
export const deleteMonthIncome = deletePeriodIncome;

// ---------------------------------------------------------------- expenses

export async function getPeriodExpenses({ hotelId, ...query }) {
  const p = resolvePeriod(query);
  const items = await Expense.find({ hotelId, date: inPeriod(p) }).sort({ date: 1 }).lean();
  const docs = await Document.find({ ownerType: 'expense', ownerId: { $in: items.map((e) => e._id) } }, { ownerId: 1, originalName: 1 }).lean();
  const bills = new Map();
  for (const d of docs) bills.set(String(d.ownerId), [...(bills.get(String(d.ownerId)) || []), d.originalName]);
  const deletableCount = items.filter((e) => isBeforeLock(p, e.date)).length;
  return {
    ...periodInfo(p),
    total: items.length,
    amount: items.reduce((s, e) => s + e.amount, 0),
    deletableCount,
    keptCount: items.length - deletableCount,
    currentMonthCount: items.length - deletableCount,
    items: items.map((e) => ({ ...e, bills: bills.get(String(e._id)) || [] })),
  };
}
export const getMonthExpenses = getPeriodExpenses;

export async function deletePeriodExpenses({ hotelId, ...query }) {
  const p = resolvePeriod(query);
  if (p.start >= p.lockFrom) throw ApiError.badRequest('The current month cannot be deleted. Choose an earlier period.');
  const result = await withOptionalTransaction(async (session) => {
    const ids = (await Expense.find({ hotelId, date: deletableWindow(p) }, { _id: 1 }).session(session || null)).map((e) => e._id);
    if (!ids.length) return { deleted: 0, documents: 0, fileIds: [] };
    const fileIds = await removeDocuments('expense', ids, session);
    const { deletedCount } = await Expense.deleteMany({ _id: { $in: ids } }, { session });
    return { deleted: deletedCount, documents: fileIds.length, fileIds };
  });
  await deleteFiles(result.fileIds);
  const { fileIds, ...summary } = result;
  return { month: query.month, period: p.key, label: p.label, ...summary };
}
export const deleteMonthExpenses = deletePeriodExpenses;
