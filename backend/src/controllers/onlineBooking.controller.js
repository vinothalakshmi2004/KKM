import { Booking, Guest } from '../models/index.js';
import { ensureHotel } from '../services/hotel.service.js';
import { onlineListFilter, unseenCount } from '../services/onlineBooking.service.js';
import { emitToHotel } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { decryptAadhaar } from '../utils/aadhaar.js';
import { getPaging, ok, paged } from '../utils/http.js';

const LIST_FIELDS = {
  onlineRef: 1, bookingNo: 1, status: 1, guestId: 1, rooms: 1, checkIn: 1, checkOut: 1, nights: 1,
  adults: 1, children: 1, grandTotal: 1, paidAmount: 1, balance: 1, seenByAdmin: 1, source: 1,
  'online.paymentStatus': 1, 'online.paymentMode': 1, createdAt: 1,
};

export async function list(req, res) {
  await ensureHotel(req.query.hotelId);
  const paging = getPaging(req.query);
  const filter = await onlineListFilter(req.query);
  const [items, total, unseen] = await Promise.all([
    Booking.find(filter, LIST_FIELDS)
      .populate('guestId', 'name phone')
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    Booking.countDocuments(filter),
    unseenCount(req.query.hotelId),
  ]);
  ok(res, { ...paged(items, total, paging), unseen });
}

export async function count(req, res) {
  await ensureHotel(req.query.hotelId);
  ok(res, { unseen: await unseenCount(req.query.hotelId) });
}

async function broadcastSeen(hotelId) {
  emitToHotel(hotelId, 'online-booking:seen', { unseen: await unseenCount(hotelId) });
}

export async function markSeen(req, res) {
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, source: 'Online' },
    { $set: { seenByAdmin: true } },
    { new: true, projection: { hotelId: 1, seenByAdmin: 1 }, timestamps: false }
  );
  if (!booking) throw ApiError.notFound('Online booking not found');
  await broadcastSeen(booking.hotelId);
  ok(res, { _id: booking._id, seenByAdmin: true }, 'Marked as seen');
}

export async function markAllSeen(req, res) {
  await ensureHotel(req.query.hotelId);
  const { modifiedCount } = await Booking.updateMany(
    { hotelId: req.query.hotelId, source: 'Online', seenByAdmin: false },
    { $set: { seenByAdmin: true } },
    { timestamps: false }
  );
  await broadcastSeen(req.query.hotelId);
  ok(res, { modified: modifiedCount }, `${modifiedCount} booking(s) marked as seen`);
}

/** Full Aadhaar number for one request. Who and when is recorded on the guest; the number is never logged. */
export async function revealAadhaar(req, res) {
  const booking = await Booking.findById(req.params.id, { guestId: 1, hotelId: 1, bookingNo: 1 });
  if (!booking) throw ApiError.notFound('Booking not found');
  const guest = await Guest.findById(booking.guestId).select('+aadhaarEncrypted');
  if (!guest?.aadhaarEncrypted) throw ApiError.notFound('No Aadhaar number is stored for this guest');

  let number;
  try {
    number = decryptAadhaar(guest.aadhaarEncrypted);
  } catch {
    throw ApiError.conflict('The stored Aadhaar number could not be decrypted (was AADHAAR_ENC_KEY changed?)');
  }

  await Guest.updateOne(
    { _id: guest._id },
    { $push: { aadhaarRevealLog: { adminId: req.user._id, adminEmail: req.user.email, bookingId: booking._id, at: new Date() } } },
    { timestamps: false }
  );
  console.log(`[aadhaar] revealed for booking ${booking.bookingNo} by admin ${req.user._id} at ${new Date().toISOString()}`);

  res.set('Cache-Control', 'no-store');
  ok(res, { aadhaar: number.replace(/(\d{4})(?=\d)/g, '$1 '), last4: guest.aadhaarLast4 });
}
