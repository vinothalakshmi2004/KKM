import { Booking, Document, Guest, Payment } from '../models/index.js';
import { collectFiles } from '../middlewares/upload.js';
import {
  addPayment, createBooking, getBookingById, transitionBooking, updateBooking,
} from '../services/booking.service.js';
import { ensureHotel } from '../services/hotel.service.js';
import { deleteMonthBookings, getMonthBookings } from '../services/bookingArchive.service.js';
import { emitToHotel } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { endOfDay, startOfDay } from '../utils/date.js';
import { escapeRegex, getPaging, ok, created, paged } from '../utils/http.js';
import { guestSearchFilter } from './guest.controller.js';

const POPULATE_GUEST = { path: 'guestId', select: 'name phone email' };

export async function list(req, res) {
  const { hotelId, status, from, to, search, guestId, type } = req.query;
  await ensureHotel(hotelId);
  const paging = getPaging(req.query);

  const filter = { hotelId };
  if (status) filter.status = status;
  if (guestId) filter.guestId = guestId;
  if (type) filter['rooms.type'] = type;
  // Stays overlapping the range
  if (from) filter.checkOut = { $gte: startOfDay(from) };
  if (to) filter.checkIn = { $lte: endOfDay(to) };
  if (search) {
    const guestIds = await Guest.find({ hotelId, ...guestSearchFilter(search) }).distinct('_id');
    filter.$or = [
      { guestId: { $in: guestIds } },
      { bookingNo: new RegExp(escapeRegex(search), 'i') },
      { 'rooms.roomNumber': search },
    ];
  }

  const [items, total] = await Promise.all([
    Booking.find(filter).populate(POPULATE_GUEST).sort({ checkIn: -1 }).skip(paging.skip).limit(paging.limit),
    Booking.countDocuments(filter),
  ]);
  ok(res, paged(items, total, paging));
}

export async function inhouse(req, res) {
  await ensureHotel(req.query.hotelId);
  const items = await Booking.find({ hotelId: req.query.hotelId, status: 'Checked-in' })
    .populate(POPULATE_GUEST)
    .sort({ checkOut: 1 });
  ok(res, items);
}

export async function get(req, res) {
  const booking = await getBookingById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  const [payments, documents, aadhaar] = await Promise.all([
    Payment.find({ bookingId: booking._id }).sort({ date: 1 }),
    Document.find({ ownerType: 'booking', ownerId: booking._id }).sort({ uploadedAt: 1 }),
    Guest.findById(booking.guestId?._id || booking.guestId, { aadhaarLast4: 1, aadhaarEncrypted: 1 }).select('+aadhaarEncrypted'),
  ]);
  const guestAadhaar = aadhaar?.aadhaarLast4
    ? { masked: `XXXX XXXX ${aadhaar.aadhaarLast4}`, canReveal: Boolean(aadhaar.aadhaarEncrypted) }
    : null;
  ok(res, { ...booking.toJSON(), payments, documents, guestAadhaar });
}

export async function create(req, res) {
  const booking = await createBooking(req.body, collectFiles(req));
  emitToHotel(booking.hotelId, 'booking:created', { booking });
  emitToHotel(booking.hotelId, 'room:updated', { action: 'booking', bookingId: booking._id });
  if (booking.paidAmount > 0) emitToHotel(booking.hotelId, 'payment:created', { bookingId: booking._id });
  created(res, booking, `Booking ${booking.bookingNo} created`);
}

export async function update(req, res) {
  // Files are uploaded before the edit is saved, and removed again if it fails
  const booking = await updateBooking(req.params.id, req.body, collectFiles(req));
  emitToHotel(booking.hotelId, 'booking:updated', { booking });
  emitToHotel(booking.hotelId, 'room:updated', { action: 'booking', bookingId: booking._id });
  ok(res, booking, 'Booking updated');
}

const transition = (action, message) => async (req, res) => {
  const booking = await transitionBooking(req.params.id, action, req.body || {});
  emitToHotel(booking.hotelId, 'booking:updated', { booking });
  emitToHotel(booking.hotelId, 'room:updated', { action, bookingId: booking._id });
  ok(res, booking, message);
};

export const checkin = transition('checkin', 'Checked in');
export const checkout = transition('checkout', 'Checked out');
export const cancel = transition('cancel', 'Booking cancelled');

/** Bookings that checked in during one month (export before deleting). */
export async function monthList(req, res) {
  await ensureHotel(req.query.hotelId);
  res.set('Cache-Control', 'no-store');
  const data = await getMonthBookings(req.query);
  // The export contains full Aadhaar numbers: record who asked for it
  console.log(`[bookings] ${data.label} export (${data.total}) for hotel ${req.query.hotelId} by admin ${req.user._id}`);
  ok(res, data);
}

/** Bulk-delete a finished past month. */
export async function monthDelete(req, res) {
  await ensureHotel(req.query.hotelId);
  const result = await deleteMonthBookings(req.query);
  console.log(`[bookings] ${result.label}: ${result.deleted} booking(s) deleted for hotel ${req.query.hotelId} by admin ${req.user._id}`);
  if (result.deleted) {
    emitToHotel(req.query.hotelId, 'booking:updated', { action: 'bulk-deleted', period: result.period });
    emitToHotel(req.query.hotelId, 'payment:deleted', { action: 'bulk-deleted', period: result.period });
  }
  ok(res, result, `${result.deleted} booking(s) from ${result.label} deleted`);
}

export async function createPayment(req, res) {
  const { payment, booking } = await addPayment(req.params.id, req.body);
  emitToHotel(booking.hotelId, 'payment:created', { payment, bookingId: booking._id });
  emitToHotel(booking.hotelId, 'booking:updated', { booking });
  created(res, { payment, booking }, 'Payment recorded');
}
