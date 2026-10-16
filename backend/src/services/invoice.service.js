import mongoose from 'mongoose';
import { withOptionalTransaction } from '../config/db.js';
import { Booking, Hotel, Invoice, Payment, nextSeq } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { nowTz, startOfDay, endOfDay } from '../utils/date.js';
import { escapeRegex, round2 } from '../utils/http.js';

/** Indian financial year (April–March) for a date, e.g. 2026-10-15 → "2026-27". */
export function financialYear(date = nowTz()) {
  const y = date.year();
  const start = date.month() >= 3 ? y : y - 1; // month() is 0-based: 3 = April
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Issue an invoice for a booking (one issued invoice per booking). */
export async function createInvoice(bookingId) {
  return withOptionalTransaction(async (session) => {
    const booking = await Booking.findById(bookingId).populate('guestId').session(session || null);
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.status === 'Cancelled') throw ApiError.conflict('Cannot invoice a cancelled booking');

    const existing = await Invoice.findOne({ bookingId: booking._id, status: 'Issued' }, { invoiceNo: 1 }).session(session || null);
    if (existing) {
      throw ApiError.conflict(`Booking already has invoice ${existing.invoiceNo}. Cancel it first to issue a new one.`, [
        { field: 'bookingId', message: 'Already invoiced', invoiceId: existing._id },
      ]);
    }

    const hotel = await Hotel.findById(booking.hotelId).session(session || null);
    const payments = await Payment.find({ bookingId: booking._id }).sort({ date: 1 }).session(session || null);
    const guest = booking.guestId || {};

    const lines = [
      ...booking.rooms.map((r) => ({
        description: `Room ${r.roomNumber} (${r.type}) · ${booking.nights} night${booking.nights === 1 ? '' : 's'}`,
        qty: booking.nights,
        rate: r.ratePerNight,
        amount: round2(r.ratePerNight * booking.nights),
      })),
      ...booking.extraCharges.map((e) => ({ description: e.label, qty: 1, rate: e.amount, amount: round2(e.amount) })),
    ];
    const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
    const taxableValue = round2(subtotal - booking.discount);
    // Intra-state supply: GST split equally into CGST and SGST
    const cgst = round2(booking.gstAmount / 2);
    const sgst = round2(booking.gstAmount - cgst);

    const now = nowTz();
    const fy = financialYear(now);
    const seq = await nextSeq(`invoice:${booking.hotelId}:${fy}`, session);

    const [invoice] = await Invoice.create(
      [
        {
          hotelId: booking.hotelId,
          bookingId: booking._id,
          invoiceNo: `INV-${fy}-${String(seq).padStart(4, '0')}`,
          financialYear: fy,
          issuedAt: now.toDate(),
          status: 'Issued',
          hotel: {
            name: hotel.name, address: hotel.address, area: hotel.area, city: hotel.city,
            phone: hotel.phone, email: hotel.email, gstin: hotel.gstin || '',
          },
          guest: {
            name: guest.name, phone: guest.phone, email: guest.email, address: guest.address,
            idProofType: guest.idProofType, idProofNumber: guest.idProofNumber,
          },
          stay: {
            bookingNo: booking.bookingNo, checkIn: booking.checkIn, checkOut: booking.checkOut,
            nights: booking.nights, adults: booking.adults, children: booking.children,
          },
          lines,
          subtotal,
          discount: booking.discount,
          taxableValue,
          gstPercent: booking.gstPercent,
          cgst,
          sgst,
          gstAmount: booking.gstAmount,
          grandTotal: booking.grandTotal,
          paidAmount: booking.paidAmount,
          balance: booking.balance,
          payments: payments.map((p) => ({ date: p.date, mode: p.mode, amount: p.amount, note: p.note })),
          bookingUpdatedAt: booking.updatedAt,
        },
      ],
      { session }
    );
    return invoice;
  });
}

export async function cancelInvoice(id, reason) {
  const invoice = await Invoice.findOneAndUpdate(
    { _id: id, status: 'Issued' },
    { $set: { status: 'Cancelled', cancelledAt: new Date(), cancelReason: reason || '' } },
    { new: true }
  );
  if (invoice) return invoice;
  if (!(await Invoice.exists({ _id: id }))) throw ApiError.notFound('Invoice not found');
  throw ApiError.conflict('This invoice is already cancelled');
}

/** Adds `outdated: true` when the booking changed after the invoice was issued. */
export async function withOutdatedFlag(invoice) {
  const booking = await Booking.findById(invoice.bookingId, { updatedAt: 1 }).lean();
  const outdated =
    invoice.status === 'Issued' && !!booking && !!invoice.bookingUpdatedAt && booking.updatedAt > invoice.bookingUpdatedAt;
  return { ...invoice.toJSON(), outdated };
}

export function listFilter({ hotelId, status, search, from, to, bookingId }) {
  const filter = { hotelId: new mongoose.Types.ObjectId(hotelId) };
  if (status) filter.status = status;
  if (bookingId) filter.bookingId = new mongoose.Types.ObjectId(bookingId);
  if (from || to) filter.issuedAt = {};
  if (from) filter.issuedAt.$gte = startOfDay(from);
  if (to) filter.issuedAt.$lte = endOfDay(to);
  if (search) {
    const text = new RegExp(escapeRegex(search), 'i');
    const or = [{ invoiceNo: text }, { 'guest.name': text }, { 'stay.bookingNo': text }];
    const digits = search.replace(/\D/g, '');
    if (digits.length >= 3) or.push({ 'guest.phone': new RegExp(escapeRegex(digits)) });
    filter.$or = or;
  }
  return filter;
}
