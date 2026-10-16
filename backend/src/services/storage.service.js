import mongoose from 'mongoose';
import { withOptionalTransaction } from '../config/db.js';
import { deleteFiles, getBucket } from '../config/gridfs.js';
import { Booking, Document, Enquiry, Expense, Guest, Invoice, Payment } from '../models/index.js';
import { nowTz, TZ } from '../utils/date.js';
import { DELETABLE_STATUSES, monthRange } from './bookingArchive.service.js';

const hid = (hotelId) => new mongoose.Types.ObjectId(String(hotelId));

/** Database and file-storage usage: the whole database, plus this hotel's share. */
export async function storageSummary(hotelId) {
  const db = mongoose.connection.db;
  const [stats, files, hotelDocs] = await Promise.all([
    db.stats(),
    getBucket().find({}, { projection: { length: 1 } }).toArray(),
    Document.aggregate([{ $match: { hotelId: hid(hotelId) } }, { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$size' } } }]),
  ]);
  const [bookings, payments, guests, expenses, enquiries, invoices] = await Promise.all([
    Booking.countDocuments({ hotelId }),
    Payment.countDocuments({ hotelId }),
    Guest.countDocuments({ hotelId }),
    Expense.countDocuments({ hotelId }),
    Enquiry.countDocuments({ hotelId }),
    Invoice.countDocuments({ hotelId }),
  ]);
  return {
    database: {
      name: db.databaseName,
      dataBytes: stats.dataSize,
      storageBytes: stats.storageSize,
      indexBytes: stats.indexSize,
      records: stats.objects,
      fileCount: files.length,
      fileBytes: files.reduce((sum, f) => sum + (f.length || 0), 0),
    },
    hotel: {
      bookings, payments, guests, expenses, enquiries, invoices,
      documents: hotelDocs[0]?.count || 0,
      documentBytes: hotelDocs[0]?.bytes || 0,
    },
  };
}

/** Bookings per month (by check-in date) with what a month delete would remove. */
export async function monthsOverview(hotelId) {
  const rows = await Booking.aggregate([
    { $match: { hotelId: hid(hotelId) } },
    { $lookup: { from: Document.collection.name, localField: '_id', foreignField: 'ownerId', as: 'docs' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$checkIn', timezone: TZ } },
        bookings: { $sum: 1 },
        finished: { $sum: { $cond: [{ $in: ['$status', DELETABLE_STATUSES] }, 1, 0] } },
        paid: { $sum: '$paidAmount' },
        files: { $sum: { $size: '$docs' } },
        fileBytes: { $sum: { $sum: '$docs.size' } },
      },
    },
    { $sort: { _id: -1 } },
  ]);
  const byMonth = (field) => [
    { $match: { hotelId: hid(hotelId) } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: `$${field}`, timezone: TZ } }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
  ];
  const [income, expenses] = await Promise.all([Payment.aggregate(byMonth('date')), Expense.aggregate(byMonth('date'))]);
  const months = new Map();
  const row = (m) => {
    if (!months.has(m)) months.set(m, { month: m, bookings: 0, finished: 0, paid: 0, files: 0, fileBytes: 0, incomeCount: 0, income: 0, expenseCount: 0, expenses: 0 });
    return months.get(m);
  };
  for (const r of rows) Object.assign(row(r._id), { bookings: r.bookings, finished: r.finished, paid: r.paid, files: r.files, fileBytes: r.fileBytes });
  for (const r of income) Object.assign(row(r._id), { incomeCount: r.count, income: r.amount });
  for (const r of expenses) Object.assign(row(r._id), { expenseCount: r.count, expenses: r.amount });
  return [...months.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((m) => {
      const range = monthRange(m.month);
      return { ...m, label: range.label, deletable: range.deletable, active: m.bookings - m.finished };
    });
}

/**
 * Guests with no bookings left (e.g. after month deletes), created before this month.
 * Returning guests would simply be added again on their next booking.
 */
async function unusedGuestIds(hotelId, session) {
  const used = await Booking.distinct('guestId', { hotelId }, { session: session || undefined });
  const rows = await Guest.find(
    { hotelId, _id: { $nin: used }, createdAt: { $lt: nowTz().startOf('month').toDate() } },
    { _id: 1 }
  ).session(session || null);
  return rows.map((r) => r._id);
}

export const countUnusedGuests = async (hotelId) => (await unusedGuestIds(hotelId)).length;

export async function deleteUnusedGuests(hotelId) {
  const result = await withOptionalTransaction(async (session) => {
    const ids = await unusedGuestIds(hotelId, session);
    if (!ids.length) return { deleted: 0, documents: 0, fileIds: [] };
    const docs = await Document.find({ ownerType: 'guest', ownerId: { $in: ids } }, { fileId: 1 }).session(session || null);
    await Document.deleteMany({ _id: { $in: docs.map((d) => d._id) } }, { session });
    const { deletedCount } = await Guest.deleteMany({ _id: { $in: ids } }, { session });
    return { deleted: deletedCount, documents: docs.length, fileIds: docs.map((d) => d.fileId) };
  });
  await deleteFiles(result.fileIds);
  const { fileIds, ...summary } = result;
  return summary;
}
