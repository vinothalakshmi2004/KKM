import { env } from '../config/env.js';
import { collectFiles } from '../middlewares/upload.js';
import { createOnlineBooking, getAvailability, getPublicStatus, getQuote } from '../services/onlineBooking.service.js';
import { paymentEnabled, paymentMode } from '../services/payment/index.js';
import { emitToHotel } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { created, ok } from '../utils/http.js';

export function config(_req, res) {
  ok(res, { paymentEnabled: paymentEnabled(), paymentMode: paymentMode(), maxUploadMb: Math.round(env.maxUploadBytes / 1024 / 1024) });
}

export async function availability(req, res) {
  res.set('Cache-Control', 'no-store');
  ok(res, await getAvailability(req.params.slug, req.query));
}

export async function quote(req, res) {
  ok(res, await getQuote(req.params.slug, req.body));
}

export async function book(req, res) {
  // Honeypot: real visitors never see or fill this field
  if (req.body.website) throw ApiError.badRequest('Your booking could not be submitted. Please try again.');

  const { booking, response } = await createOnlineBooking(req.params.slug, req.body, collectFiles(req), {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Same events as an admin booking, plus the online-only one. No Aadhaar data in any of them.
  emitToHotel(booking.hotelId, 'booking:created', { booking });
  emitToHotel(booking.hotelId, 'room:updated', { action: 'booking', bookingId: booking._id });
  emitToHotel(booking.hotelId, 'online-booking:created', {
    bookingId: booking._id,
    onlineRef: booking.onlineRef,
    guestName: booking.guestId?.name || '',
    roomNumbers: booking.rooms.map((r) => r.roomNumber),
    checkIn: booking.checkIn,
  });

  created(res, response, `Booking confirmed: ${booking.onlineRef}`);
}

export async function status(req, res) {
  res.set('Cache-Control', 'no-store');
  ok(res, await getPublicStatus(req.query));
}
