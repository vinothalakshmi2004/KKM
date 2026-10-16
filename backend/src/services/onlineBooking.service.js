import { env } from '../config/env.js';
import { ACTIVE_STATUSES, Booking, GalleryImage, Guest, Hotel, Room, nextSeq } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { encryptAadhaar } from '../utils/aadhaar.js';
import { dayjs, nightsBetween, nowTz, TZ } from '../utils/date.js';
import { escapeRegex, round2 } from '../utils/http.js';
import { computeTotals, createBooking } from './booking.service.js';
import { createDocuments, discardUploads, stageUploads } from './document.service.js';
import { getPaymentProvider, paymentMode } from './payment/index.js';

export const MAX_ONLINE_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;
const TYPE_ORDER = ['AC', 'Non-AC'];
const naturalSort = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

// ---------------------------------------------------------------- hotel + period

export async function findBookableHotel(slug, { session } = {}) {
  const hotel = await Hotel.findOne({ slug, isActive: true }).session(session || null);
  if (!hotel) throw ApiError.notFound('Hotel not found');
  if (!hotel.onlineBookingEnabled) {
    throw ApiError.forbidden('Online booking is not available for this hotel. Please contact the hotel directly.');
  }
  return hotel;
}

/** Same date rules for availability, quote and book. */
export function assertStayPeriod(checkIn, checkOut) {
  if (checkOut <= checkIn) throw ApiError.badRequest('Check-out must be after check-in');
  const today = nowTz().startOf('day');
  if (dayjs(checkIn).tz(TZ).isBefore(today)) throw ApiError.badRequest('Check-in date cannot be in the past');
  if (checkOut <= new Date()) throw ApiError.badRequest('Check-out time has already passed');
  if (dayjs(checkIn).tz(TZ).isAfter(today.add(MAX_ADVANCE_DAYS, 'day'))) {
    throw ApiError.badRequest(`Bookings can be made up to ${MAX_ADVANCE_DAYS} days ahead`);
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights > MAX_ONLINE_NIGHTS) throw ApiError.badRequest(`Online bookings are limited to ${MAX_ONLINE_NIGHTS} nights`);
  return nights;
}

/** Rooms free for the whole period (not in maintenance, no overlapping active booking), lowest numbers first. */
async function freeRooms(hotelId, checkIn, checkOut, session) {
  const busy = await Booking.distinct(
    'rooms.roomId',
    { hotelId, status: { $in: ACTIVE_STATUSES }, checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
    { session: session || undefined }
  );
  const rooms = await Room.find({ hotelId, status: { $ne: 'Maintenance' }, _id: { $nin: busy } }).session(session || null);
  return rooms.sort((a, b) => naturalSort.compare(a.roomNumber, b.roomNumber));
}

/**
 * Every room can be let as AC or Non-AC, so both types draw on the same free rooms.
 * The lowest free room numbers go to AC first, then Non-AC.
 */
function assignRooms(free, selection, guests) {
  const wanted = TYPE_ORDER.flatMap((type) => Array(selection[type] || 0).fill(type));
  if (!wanted.length) throw ApiError.badRequest('Select at least one room');
  if (wanted.length > free.length) {
    throw ApiError.conflict(
      free.length
        ? `Sorry, only ${free.length} room${free.length === 1 ? ' is' : 's are'} free for these dates now. Please choose again.`
        : 'Sorry, the rooms for these dates were just booked by someone else. Please choose other dates.',
      [{ code: 'ROOMS_TAKEN', available: free.length }]
    );
  }
  const picked = wanted.map((type, i) => ({ room: free[i], type }));
  const capacity = picked.reduce((sum, p) => sum + (p.room.maxGuests || 0), 0);
  if (guests > capacity) {
    throw ApiError.badRequest(
      `${picked.length} room${picked.length === 1 ? '' : 's'} can hold ${capacity} guest${capacity === 1 ? '' : 's'}. Please add another room.`,
      [{ code: 'CAPACITY', capacity }]
    );
  }
  return picked;
}

const selectionOf = (rooms) =>
  rooms.reduce((acc, r) => ({ ...acc, [r.type]: (acc[r.type] || 0) + r.quantity }), {});

/** Price lines grouped by type and rate (no room numbers before the booking is made). */
function pricing(hotel, picked, nights) {
  const snapshots = picked.map((p) => ({ type: p.type, ratePerNight: p.room.priceFor(p.type) }));
  const totals = computeTotals({ rooms: snapshots, nights, gstPercent: hotel.gstPercent || 0 });
  const groups = new Map();
  for (const s of snapshots) {
    const key = `${s.type}|${s.ratePerNight}`;
    const g = groups.get(key) || { type: s.type, ratePerNight: s.ratePerNight, quantity: 0 };
    g.quantity += 1;
    groups.set(key, g);
  }
  const lines = [...groups.values()].map((g) => ({ ...g, nights, amount: round2(g.ratePerNight * g.quantity * nights) }));
  return {
    nights,
    lines,
    roomTotal: totals.roomTotal,
    gstPercent: hotel.gstPercent || 0,
    gstAmount: totals.gstAmount,
    grandTotal: totals.grandTotal,
  };
}

// ---------------------------------------------------------------- public: availability / quote

export async function getAvailability(slug, { checkIn, checkOut, adults = 1, children = 0 }) {
  const hotel = await findBookableHotel(slug);
  const nights = assertStayPeriod(checkIn, checkOut);
  const [free, gallery] = await Promise.all([
    freeRooms(hotel._id, checkIn, checkOut),
    GalleryImage.find({ hotelId: hotel._id }).sort({ order: 1, createdAt: 1 }).limit(8),
  ]);

  const photos = [
    ...(hotel.coverImageId ? [`/api/hotels/${hotel._id}/cover`] : []),
    ...gallery.map((g) => g.imageUrl),
  ];
  const amenities = [...new Set(free.flatMap((r) => r.amenities || []))];
  const guests = adults + children;
  const capacity = free.reduce((sum, r) => sum + (r.maxGuests || 0), 0);

  const roomTypes = free.length
    ? TYPE_ORDER.map((type) => {
        const prices = free.map((r) => r.priceFor(type));
        return {
          type,
          availableCount: free.length,
          pricePerNight: Math.min(...prices),
          maxPricePerNight: Math.max(...prices),
          amenities: type === 'Non-AC' ? amenities.filter((a) => a.trim().toLowerCase() !== 'ac') : amenities,
          maxGuests: Math.max(...free.map((r) => r.maxGuests || 1)),
          photos,
        };
      }).sort((a, b) => a.pricePerNight - b.pricePerNight)
    : [];

  return {
    checkIn,
    checkOut,
    nights,
    adults,
    children,
    // AC and Non-AC share the same free rooms: the total chosen across both may not exceed this
    totalAvailable: free.length,
    sharedRooms: true,
    enoughCapacity: capacity >= guests,
    roomTypes,
  };
}

export async function getQuote(slug, { checkIn, checkOut, adults = 1, children = 0, rooms }) {
  const hotel = await findBookableHotel(slug);
  const nights = assertStayPeriod(checkIn, checkOut);
  const free = await freeRooms(hotel._id, checkIn, checkOut);
  const picked = assignRooms(free, selectionOf(rooms), adults + children);
  return { checkIn, checkOut, adults, children, ...pricing(hotel, picked, nights) };
}

// ---------------------------------------------------------------- public: book

async function activeOnlineBookingsForPhone(phone) {
  const guestIds = await Guest.find({ phone }).distinct('_id');
  if (!guestIds.length) return 0;
  return Booking.countDocuments({
    guestId: { $in: guestIds },
    source: 'Online',
    status: { $in: ACTIVE_STATUSES },
    checkOut: { $gt: new Date() },
  });
}

/**
 * Instant online booking. Rooms are assigned and availability is re-checked inside the
 * existing booking write (transaction, or the per-hotel lock without one), so two guests
 * can never get the same room. Totals come from the existing booking service.
 */
export async function createOnlineBooking(slug, input, files, meta) {
  const hotel = await findBookableHotel(slug);
  const nights = assertStayPeriod(input.checkIn, input.checkOut);
  const guests = input.adults + input.children;

  if (hotel.requireAadhaarUpload && !files.length) {
    throw ApiError.badRequest('Please upload your Aadhaar card (front, and back if separate)', [{ field: 'aadhaarFiles', message: 'Required' }]);
  }

  const active = await activeOnlineBookingsForPhone(input.guest.phone);
  if (active >= env.onlineMaxActivePerPhone) {
    throw ApiError.conflict(
      `This phone number already has ${active} upcoming online booking${active === 1 ? '' : 's'}. ` +
        'Please contact the hotel to book more rooms.',
      [{ code: 'PHONE_LIMIT' }]
    );
  }

  const selection = selectionOf(input.rooms);
  const year = nowTz().year();
  const provider = getPaymentProvider();

  // Copies for the guest record; the booking's copies are staged by createBooking
  const guestFiles = await stageUploads(files, { hotelId: hotel._id, ownerType: 'guest' });
  let booking;
  try {
    booking = await createBooking(
      {
        hotelId: hotel._id,
        guest: {
          name: input.guest.name,
          phone: input.guest.phone,
          email: input.guest.email,
          address: input.guest.address,
          idProofType: 'Aadhaar',
        },
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: input.adults,
        children: input.children,
        source: 'Online',
      },
      files,
      {
        resolveRooms: async (session) => {
          const free = await freeRooms(hotel._id, input.checkIn, input.checkOut, session);
          return assignRooms(free, selection, guests).map((p) => ({ roomId: p.room._id, type: p.type }));
        },
        extraFields: async (session) => {
          const seq = await nextSeq(`online:${hotel._id}:${year}`, session);
          return {
            onlineRef: `OB-${year}-${String(seq).padStart(4, '0')}`,
            seenByAdmin: false,
            online: {
              ip: meta.ip || '',
              userAgent: String(meta.userAgent || '').slice(0, 300),
              consentAt: new Date(),
              paymentMode: paymentMode(),
              paymentStatus: 'Pay at hotel',
            },
          };
        },
        afterCreate: async ({ guest, session }) => {
          guest.aadhaarLast4 = input.aadhaar.slice(-4);
          guest.aadhaarEncrypted = encryptAadhaar(input.aadhaar);
          // Keep the number itself out of the plain idProofNumber field
          guest.idProofType = 'Aadhaar';
          guest.idProofNumber = `XXXX XXXX ${input.aadhaar.slice(-4)}`;
          await guest.save({ session });
          await createDocuments(guestFiles, { ownerType: 'guest', ownerId: guest._id, hotelId: hotel._id }, session);
        },
      }
    );
  } catch (err) {
    await discardUploads(guestFiles);
    throw err;
  }

  // Dummy mode: nothing is charged and no Payment is created
  const payment = await provider.createOrder(booking);

  return {
    booking,
    response: {
      onlineRef: booking.onlineRef,
      bookingNo: booking.bookingNo,
      status: booking.status,
      roomNumbers: booking.rooms.map((r) => r.roomNumber),
      rooms: booking.rooms.map((r) => ({ roomNumber: r.roomNumber, type: r.type, ratePerNight: r.ratePerNight })),
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      adults: booking.adults,
      children: booking.children,
      pricing: {
        nights: booking.nights ?? nights,
        roomTotal: booking.roomTotal,
        gstPercent: booking.gstPercent,
        gstAmount: booking.gstAmount,
        grandTotal: booking.grandTotal,
        paidAmount: booking.paidAmount,
        balance: booking.balance,
      },
      payment: { ...payment, paymentStatus: booking.online?.paymentStatus || 'Pay at hotel' },
      guestName: booking.guestId?.name || input.guest.name,
      hotel: publicHotelContact(hotel),
    },
  };
}

export const publicHotelContact = (hotel) => ({
  name: hotel.name,
  slug: hotel.slug,
  address: hotel.address,
  area: hotel.area,
  city: hotel.city,
  phone: hotel.phone,
  whatsappNumber: hotel.whatsappNumber,
  lat: hotel.lat,
  lng: hotel.lng,
  mapEmbedUrl: hotel.mapEmbedUrl,
  checkInTime: hotel.checkInTime,
  checkOutTime: hotel.checkOutTime,
});

// ---------------------------------------------------------------- public: status

export async function getPublicStatus({ ref, phone }) {
  // References are numbered per hotel, so the same one can exist in two hotels: newest match wins
  const candidates = await Booking.find({ onlineRef: ref, source: 'Online' }).sort({ createdAt: -1 }).populate('guestId', 'phone name');
  const booking = candidates.find((b) => b.guestId?.phone === phone);
  // Same answer for "no such reference" and "wrong phone"
  if (!booking) throw ApiError.notFound('No booking found for this reference and phone number');
  const hotel = await Hotel.findById(booking.hotelId);
  return {
    onlineRef: booking.onlineRef,
    bookingNo: booking.bookingNo,
    status: booking.status,
    guestName: booking.guestId?.name,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights: booking.nights,
    roomNumbers: booking.rooms.map((r) => r.roomNumber),
    rooms: booking.rooms.map((r) => ({ roomNumber: r.roomNumber, type: r.type })),
    grandTotal: booking.grandTotal,
    paidAmount: booking.paidAmount,
    balance: booking.balance,
    paymentStatus: booking.online?.paymentStatus || 'Pay at hotel',
    hotel: hotel ? publicHotelContact(hotel) : null,
  };
}

// ---------------------------------------------------------------- admin

/** Tabs: new (unseen) / upcoming / checked-in / completed / cancelled / all. */
const TAB_FILTERS = {
  new: { seenByAdmin: false },
  upcoming: { status: 'Booked' },
  'checked-in': { status: 'Checked-in' },
  completed: { status: 'Checked-out' },
  cancelled: { status: 'Cancelled' },
  all: {},
};
export const ONLINE_TABS = Object.keys(TAB_FILTERS);

export async function onlineListFilter({ hotelId, status, unseen, from, to, search }) {
  const filter = { hotelId, source: 'Online', ...(TAB_FILTERS[status] || {}) };
  if (unseen) filter.seenByAdmin = false;
  // Stays overlapping the range
  if (from) filter.checkOut = { $gte: from };
  if (to) filter.checkIn = { $lte: to };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const digits = search.replace(/\D/g, '');
    const guestIds = await Guest.find({
      hotelId,
      $or: [{ name: rx }, ...(digits.length >= 3 ? [{ phone: new RegExp(escapeRegex(digits)) }] : [])],
    }).distinct('_id');
    filter.$or = [{ onlineRef: rx }, { bookingNo: rx }, { 'rooms.roomNumber': search }, { guestId: { $in: guestIds } }];
  }
  return filter;
}

export const unseenCount = (hotelId) => Booking.countDocuments({ hotelId, source: 'Online', seenByAdmin: false });
