import mongoose from 'mongoose';
import { Payment } from '../models/index.js';
import { removePayment } from '../services/booking.service.js';
import { ensureHotel } from '../services/hotel.service.js';
import { emitToHotel } from '../sockets/index.js';
import { endOfDay, startOfDay } from '../utils/date.js';
import { getPaging, ok, paged, round2 } from '../utils/http.js';

export async function list(req, res) {
  const { hotelId, from, to, mode, bookingId } = req.query;
  await ensureHotel(hotelId);
  const paging = getPaging(req.query);

  // Income is by payment date
  const filter = { hotelId: new mongoose.Types.ObjectId(hotelId) };
  if (from || to) filter.date = {};
  if (from) filter.date.$gte = startOfDay(from);
  if (to) filter.date.$lte = endOfDay(to);
  if (mode) filter.mode = mode;
  if (bookingId) filter.bookingId = new mongoose.Types.ObjectId(bookingId);

  const [items, total, byMode] = await Promise.all([
    Payment.find(filter)
      .populate({ path: 'bookingId', select: 'bookingNo guestId rooms', populate: { path: 'guestId', select: 'name phone' } })
      .sort({ date: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    Payment.countDocuments(filter),
    // Totals cover every matching payment, not just this page
    Payment.aggregate([
      { $match: filter },
      { $group: { _id: '$mode', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]),
  ]);

  const totals = {
    amount: round2(byMode.reduce((s, m) => s + m.amount, 0)),
    count: byMode.reduce((s, m) => s + m.count, 0),
    byMode: byMode.map((m) => ({ mode: m._id, amount: round2(m.amount), count: m.count })),
  };
  ok(res, { ...paged(items, total, paging), totals });
}

export async function remove(req, res) {
  const { payment, booking } = await removePayment(req.params.id);
  if (booking) emitToHotel(booking.hotelId, 'booking:updated', { booking });
  emitToHotel(payment.hotelId, 'payment:deleted', { paymentId: payment._id, bookingId: payment.bookingId });
  ok(res, { booking }, 'Payment deleted');
}
