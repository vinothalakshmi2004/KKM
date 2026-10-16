import { Enquiry, GalleryImage, Hotel, Room } from '../models/index.js';
import { emitToHotel } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { getPaging, ok, created, paged } from '../utils/http.js';

const coverUrl = (h) => (h.coverImageId ? `/api/hotels/${h._id}/cover` : null);

export async function listHotels(req, res) {
  const paging = getPaging(req.query);
  const filter = { isActive: true };

  const [rows, total] = await Promise.all([
    Hotel.aggregate([
      { $match: filter },
      { $sort: { name: 1 } },
      { $skip: paging.skip },
      { $limit: paging.limit },
      {
        $lookup: {
          from: Room.collection.name,
          let: { hid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$hotelId', '$$hid'] } } },
            // Cheapest stay is usually Non-AC
            { $group: { _id: null, min: { $min: { $min: ['$acPrice', '$nonAcPrice'] } }, count: { $sum: 1 } } },
          ],
          as: 'price',
        },
      },
      {
        $project: {
          name: 1, slug: 1, area: 1, city: 1, description: 1, coverImageId: 1, whatsappNumber: 1,
          onlineBookingEnabled: { $ifNull: ['$onlineBookingEnabled', true] },
          startingPrice: { $ifNull: [{ $first: '$price.min' }, null] },
          roomCount: { $ifNull: [{ $first: '$price.count' }, 0] },
        },
      },
    ]),
    Hotel.countDocuments(filter),
  ]);

  const items = rows.map(({ coverImageId, ...h }) => ({ ...h, coverUrl: coverUrl({ _id: h._id, coverImageId }) }));
  ok(res, paged(items, total, paging));
}

export async function getHotel(req, res) {
  const hotel = await Hotel.findOne({ slug: req.params.slug, isActive: true });
  if (!hotel) throw ApiError.notFound('Hotel not found');

  const [[stats], gallery] = await Promise.all([
    Room.aggregate([
      { $match: { hotelId: hotel._id } },
      {
        $group: {
          _id: null,
          acMin: { $min: '$acPrice' },
          acMax: { $max: '$acPrice' },
          nonAcMin: { $min: '$nonAcPrice' },
          nonAcMax: { $max: '$nonAcPrice' },
          maxGuests: { $max: '$maxGuests' },
          amenities: { $addToSet: '$amenities' },
          rooms: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0, acMin: 1, acMax: 1, nonAcMin: 1, nonAcMax: 1, maxGuests: 1, rooms: 1,
          amenities: { $reduce: { input: '$amenities', initialValue: [], in: { $setUnion: ['$$value', '$$this'] } } },
        },
      },
    ]),
    GalleryImage.find({ hotelId: hotel._id }).sort({ order: 1, createdAt: 1 }),
  ]);

  ok(res, {
    _id: hotel._id,
    name: hotel.name,
    slug: hotel.slug,
    description: hotel.description,
    address: hotel.address,
    area: hotel.area,
    city: hotel.city,
    phone: hotel.phone,
    whatsappNumber: hotel.whatsappNumber,
    email: hotel.email,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    mapEmbedUrl: hotel.mapEmbedUrl,
    lat: hotel.lat,
    lng: hotel.lng,
    coverUrl: hotel.coverUrl,
    onlineBookingEnabled: hotel.onlineBookingEnabled,
    requireAadhaarUpload: hotel.requireAadhaarUpload,
    onlineBookingNote: hotel.onlineBookingNote,
    gstPercent: hotel.gstPercent,
    startingPrice: stats ? Math.min(stats.acMin, stats.nonAcMin) : null,
    // Every room can be taken as AC or Non-AC
    roomTypes: stats
      ? [
          { type: 'Non-AC', startingPrice: stats.nonAcMin, maxPrice: stats.nonAcMax, maxGuests: stats.maxGuests, rooms: stats.rooms, amenities: stats.amenities.filter((a) => a !== 'AC') },
          { type: 'AC', startingPrice: stats.acMin, maxPrice: stats.acMax, maxGuests: stats.maxGuests, rooms: stats.rooms, amenities: stats.amenities },
        ].sort((a, b) => a.startingPrice - b.startingPrice)
      : [],
    gallery: gallery.map((g) => ({ _id: g._id, caption: g.caption, imageUrl: g.imageUrl })),
  });
}

export async function createEnquiry(req, res) {
  const { hotelSlug, ...data } = req.body;
  const hotel = await Hotel.findOne({ slug: hotelSlug, isActive: true });
  if (!hotel) throw ApiError.notFound('Hotel not found');

  const enquiry = await Enquiry.create({ ...data, hotelId: hotel._id, status: 'New' });
  emitToHotel(hotel._id, 'enquiry:created', { enquiry });

  created(
    res,
    { _id: enquiry._id, hotelName: hotel.name, whatsappNumber: hotel.whatsappNumber },
    'Thank you! The hotel will contact you shortly.'
  );
}
