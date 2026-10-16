import { Booking, Enquiry } from '../models/index.js';
import { ensureHotel } from '../services/hotel.service.js';
import { ApiError } from '../utils/ApiError.js';
import { getPaging, ok, paged } from '../utils/http.js';

export async function list(req, res) {
  const { hotelId, status } = req.query;
  await ensureHotel(hotelId);
  const paging = getPaging(req.query);
  const filter = { hotelId, ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    Enquiry.find(filter).populate('bookingId', 'bookingNo status').sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
    Enquiry.countDocuments(filter),
  ]);
  ok(res, paged(items, total, paging));
}

export async function update(req, res) {
  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound('Enquiry not found');
  if (req.body.bookingId) {
    const linked = await Booking.exists({ _id: req.body.bookingId, hotelId: enquiry.hotelId });
    if (!linked) throw ApiError.badRequest('Booking not found in this hotel');
  }
  Object.assign(enquiry, req.body);
  await enquiry.save();
  ok(res, enquiry, 'Enquiry updated');
}
