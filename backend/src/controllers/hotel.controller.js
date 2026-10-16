import {
  Booking, Counter, Document, Enquiry, Expense, ExpenseCategory, GalleryImage, Guest, Hotel, Room,
} from '../models/index.js';
import { deleteFile, deleteFiles, streamFile, uploadFile } from '../config/gridfs.js';
import { createDefaultCategories, ensureHotel } from '../services/hotel.service.js';
import { bookingWrite } from '../services/booking.service.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, getPaging, ok, created, paged } from '../utils/http.js';
import { uniqueSlug, slugify } from '../utils/slug.js';

const slugTaken = (excludeId) => (slug) => Hotel.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });

export async function list(req, res) {
  const { search, active } = req.query;
  const paging = getPaging(req.query);
  const filter = {};
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');
  if (active !== undefined) filter.isActive = active;

  const [items, total] = await Promise.all([
    Hotel.find(filter).sort({ name: 1 }).skip(paging.skip).limit(paging.limit),
    Hotel.countDocuments(filter),
  ]);
  ok(res, paged(items, total, paging));
}

export async function get(req, res) {
  ok(res, await ensureHotel(req.params.id));
}

export async function create(req, res) {
  const body = req.body;
  const slug = await uniqueSlug(body.slug || body.name, slugTaken());
  const coverImageId = req.file ? await uploadFile(req.file, { kind: 'hotel-cover' }) : null;

  try {
    const hotel = await Hotel.create({ ...body, slug, coverImageId });
    await createDefaultCategories(hotel._id);
    created(res, hotel, 'Hotel created');
  } catch (err) {
    await deleteFile(coverImageId);
    throw err;
  }
}

export async function update(req, res) {
  const hotel = await ensureHotel(req.params.id);
  const { removeCover, ...body } = req.body;

  if (body.slug !== undefined) {
    const wanted = slugify(body.slug);
    if (await slugTaken(hotel._id)(wanted)) throw ApiError.conflict(`The slug "${wanted}" is already used by another hotel`);
    body.slug = wanted;
  }

  const oldCoverId = hotel.coverImageId;
  const newCoverId = req.file ? await uploadFile(req.file, { kind: 'hotel-cover', hotelId: String(hotel._id) }) : null;

  try {
    Object.assign(hotel, body);
    if (newCoverId) hotel.coverImageId = newCoverId;
    else if (removeCover) hotel.coverImageId = null;
    await hotel.save();
  } catch (err) {
    await deleteFile(newCoverId);
    throw err;
  }

  // Old cover goes only after the new one is safely saved
  if (oldCoverId && String(oldCoverId) !== String(hotel.coverImageId)) await deleteFile(oldCoverId);
  ok(res, hotel, 'Hotel updated');
}

export async function remove(req, res) {
  const hotel = await ensureHotel(req.params.id);
  const hotelId = hotel._id;

  // Check for bookings and remove the hotel and its rooms atomically with respect to new bookings
  await bookingWrite(hotelId, async (session) => {
    const bookingCount = await Booking.countDocuments({ hotelId }).session(session || null);
    if (bookingCount) {
      throw ApiError.conflict(
        `This hotel has ${bookingCount} booking(s) and cannot be deleted. Mark it inactive instead.`
      );
    }
    await Room.deleteMany({ hotelId }, { session });
    await Hotel.deleteOne({ _id: hotelId }, { session });
  });

  // The hotel is gone; clean up everything else it owned
  const [docs, gallery] = await Promise.all([
    Document.find({ hotelId }, { fileId: 1 }),
    GalleryImage.find({ hotelId }, { fileId: 1 }),
  ]);
  await deleteFiles([...docs.map((d) => d.fileId), ...gallery.map((g) => g.fileId), hotel.coverImageId]);

  await Promise.all([
    Document.deleteMany({ hotelId }),
    GalleryImage.deleteMany({ hotelId }),
    Guest.deleteMany({ hotelId }),
    Expense.deleteMany({ hotelId }),
    ExpenseCategory.deleteMany({ hotelId }),
    Enquiry.deleteMany({ hotelId }),
    Counter.deleteMany({ _id: new RegExp(`^booking:${hotelId}:`) }),
  ]);
  ok(res, null, 'Hotel deleted');
}

/** Public, cached cover image. */
export async function cover(req, res) {
  const hotel = await Hotel.findById(req.params.id, { coverImageId: 1 });
  if (!hotel?.coverImageId) throw ApiError.notFound('No cover image');
  if (req.headers['if-none-match'] === `"${hotel.coverImageId}"`) return res.status(304).end();
  const found = await streamFile(res, hotel.coverImageId, { cache: true });
  if (!found) throw ApiError.notFound('No cover image');
}
