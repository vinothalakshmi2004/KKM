import { supportsTransactions, withOptionalTransaction } from '../config/db.js';
import { withKeyedLock } from '../utils/keyedLock.js';
import { Booking, Enquiry, Guest, Payment, Room, nextSeq } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { nightsBetween, nowTz, dayjs, TZ } from '../utils/date.js';
import { round2 } from '../utils/http.js';
import { findConflicts } from './availability.service.js';
import { ensureHotel } from './hotel.service.js';
import { createDocuments, discardUploads, stageUploads } from './document.service.js';

// ---------------------------------------------------------------- totals

/** Server-side totals. Client-sent totals are never trusted. */
export function computeTotals({ rooms, nights, extraCharges = [], discount = 0, gstPercent = 0 }) {
  const roomTotal = round2(rooms.reduce((sum, r) => sum + r.ratePerNight * nights, 0));
  const extrasTotal = round2(extraCharges.reduce((sum, e) => sum + e.amount, 0));
  const taxable = round2(roomTotal + extrasTotal - discount);
  if (taxable < 0) throw ApiError.badRequest('Discount cannot be more than the room total plus extra charges');
  const gstAmount = round2((taxable * gstPercent) / 100);
  return { roomTotal, gstAmount, grandTotal: round2(taxable + gstAmount) };
}

/** paidAmount = sum of payments, balance = grandTotal - paidAmount. */
export async function recalcPaid(booking, session) {
  const [agg] = await Payment.aggregate([
    { $match: { bookingId: booking._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).session(session || null);
  booking.paidAmount = round2(agg?.total || 0);
  booking.balance = round2(booking.grandTotal - booking.paidAmount);
  await booking.save({ session });
  return booking;
}

// ---------------------------------------------------------------- helpers

/** Use guestId, or find-by-phone-and-update / create from a guest object. */
async function resolveGuest({ hotelId, guestId, guest }, session) {
  if (guestId) {
    const found = await Guest.findOne({ _id: guestId, hotelId }).session(session || null);
    if (!found) throw ApiError.badRequest('Guest not found in this hotel');
    return found;
  }
  if (!guest) throw ApiError.badRequest('Provide either guestId or a guest object');

  const existing = await Guest.findOne({ hotelId, phone: guest.phone }).session(session || null);
  if (existing) {
    // Only overwrite fields that were actually sent
    for (const [key, value] of Object.entries(guest)) {
      if (value !== undefined && value !== '') existing[key] = value;
    }
    return existing.save({ session });
  }
  const [created] = await Guest.create([{ ...guest, hotelId }], { session });
  return created;
}

/**
 * Snapshot the requested rooms. Each room is booked as AC or Non-AC ("type").
 * Mode: from the request, else the mode already on the booking (when editing), else AC.
 * Rate per night: override from the request, else the rate already on the booking for the
 * same room and mode, else the room's current price for that mode.
 */
async function loadRooms(hotelId, requested, session, existing = new Map()) {
  const unique = [...new Map(requested.map((r) => [String(r.roomId), r])).values()];
  const docs = await Room.find({ _id: { $in: unique.map((r) => r.roomId) }, hotelId }).session(session || null);
  if (docs.length !== unique.length) throw ApiError.badRequest('One or more rooms do not exist in this hotel');

  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return unique.map((r) => {
    const room = byId.get(String(r.roomId));
    const before = existing.get(String(room._id));
    const type = r.type ?? before?.type ?? 'AC';
    const keptRate = before && before.type === type ? before.ratePerNight : undefined;
    return {
      doc: room,
      snapshot: {
        roomId: room._id,
        roomNumber: room.roomNumber,
        type,
        ratePerNight: r.ratePerNight ?? keptRate ?? room.priceFor(type),
      },
    };
  });
}

/**
 * Inside a transaction, touch each room so concurrent transactions booking the
 * same room hit a write conflict and get retried (and then see each other's booking).
 */
async function lockRooms(roomIds, session) {
  if (session) await Room.updateMany({ _id: { $in: roomIds } }, { $inc: { bookingLock: 1 } }, { session });
}

const fmt = (d) => dayjs(d).tz(TZ).format('DD-MMM-YYYY hh:mm A');

async function assertBookable({ hotelId, rooms, checkIn, checkOut, excludeBookingId, session }) {
  const maintenance = rooms.filter((r) => r.doc.status === 'Maintenance');
  if (maintenance.length) {
    throw ApiError.conflict(
      `Room ${maintenance.map((r) => r.doc.roomNumber).join(', ')} is under maintenance`,
      maintenance.map((r) => ({ roomId: r.doc._id, roomNumber: r.doc.roomNumber, reason: 'Maintenance' }))
    );
  }

  const roomIds = rooms.map((r) => r.doc._id);
  const conflicts = await findConflicts({ hotelId, roomIds, checkIn, checkOut, excludeBookingId, session });
  if (conflicts.length) {
    const wanted = new Set(roomIds.map(String));
    const errors = conflicts.flatMap((b) =>
      b.rooms
        .filter((r) => wanted.has(String(r.roomId)))
        .map((r) => ({
          roomId: r.roomId,
          roomNumber: r.roomNumber,
          bookingNo: b.bookingNo,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
        }))
    );
    const first = errors[0];
    throw ApiError.conflict(
      `Room ${[...new Set(errors.map((e) => e.roomNumber))].join(', ')} is not available: ` +
        `already booked ${fmt(first.checkIn)} to ${fmt(first.checkOut)} (${first.bookingNo})`,
      errors
    );
  }
}

const assertDates = (checkIn, checkOut) => {
  if (checkOut <= checkIn) throw ApiError.badRequest('Check-out must be after check-in');
};

/**
 * Booking writes for one hotel. With transactions, MongoDB serialises conflicting
 * writes itself. Without them (standalone server), bookings for the same hotel are
 * queued in this process so check-then-insert cannot interleave.
 */
export const bookingWrite = (hotelId, fn) =>
  supportsTransactions()
    ? withOptionalTransaction(fn)
    : withKeyedLock(`booking:${hotelId}`, () => withOptionalTransaction(fn));

const BOOKING_POPULATE = [{ path: 'guestId', select: 'name phone email address idProofType idProofNumber' }];

export const getBookingById = (id) => Booking.findById(id).populate(BOOKING_POPULATE);

// ---------------------------------------------------------------- create / update

/**
 * Optional `options` (used by online booking, admin bookings pass none):
 *   resolveRooms(session) → rooms to book, chosen inside the same lock/transaction
 *   extraFields(session)  → extra booking fields (e.g. onlineRef), merged into the new booking
 *   afterCreate({ booking, guest, session }) → more writes in the same transaction
 */
export async function createBooking(input, files = [], options = {}) {
  const { hotelId } = input;
  assertDates(input.checkIn, input.checkOut);
  await ensureHotel(hotelId);

  // Files go to GridFS first; if anything below fails they are removed again
  const staged = await stageUploads(files, { hotelId, ownerType: 'booking' });

  try {
    const bookingId = await bookingWrite(hotelId, async (session) => {
      const hotel = await ensureHotel(hotelId, { session });
      const requested = options.resolveRooms ? await options.resolveRooms(session) : input.rooms;
      const rooms = await loadRooms(hotelId, requested, session);
      await lockRooms(rooms.map((r) => r.doc._id), session);

      let enquiry = null;
      if (input.enquiryId) {
        enquiry = await Enquiry.findOne({ _id: input.enquiryId, hotelId }).session(session || null);
        if (!enquiry) throw ApiError.badRequest('Enquiry not found in this hotel');
      }

      const nights = nightsBetween(input.checkIn, input.checkOut);
      const snapshots = rooms.map((r) => r.snapshot);
      const extraCharges = input.extraCharges || [];
      const discount = input.discount || 0;
      const gstPercent = input.gstPercent ?? hotel.gstPercent ?? 0;
      const totals = computeTotals({ rooms: snapshots, nights, extraCharges, discount, gstPercent });

      // Availability is checked right before the first write. Without transactions the
      // per-hotel lock keeps other bookings out until this one is saved.
      await assertBookable({ hotelId, rooms, checkIn: input.checkIn, checkOut: input.checkOut, session });

      // Writes start here: nothing above may have touched the database
      const guest = await resolveGuest({ hotelId, guestId: input.guestId, guest: input.guest }, session);
      const year = nowTz().year();
      const seq = await nextSeq(`booking:${hotelId}:${year}`, session);
      const bookingNo = `BK-${year}-${String(seq).padStart(4, '0')}`;
      const extra = options.extraFields ? await options.extraFields(session) : {};

      const [booking] = await Booking.create(
        [
          {
            hotelId,
            bookingNo,
            guestId: guest._id,
            rooms: snapshots,
            adults: input.adults ?? 1,
            children: input.children ?? 0,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            nights,
            extraCharges,
            discount,
            gstPercent,
            ...totals,
            paidAmount: 0,
            balance: totals.grandTotal,
            status: 'Booked',
            source: input.source || (enquiry ? 'WhatsApp' : 'Walk-in'),
            enquiryId: enquiry?._id || null,
            notes: input.notes || '',
            ...extra,
          },
        ],
        { session }
      );

      if (input.advancePayment?.amount > 0) {
        await Payment.create(
          // Labelled so income shows it as an advance (an explicit note still wins)
          [{ hotelId, bookingId: booking._id, date: new Date(), ...input.advancePayment, note: input.advancePayment.note || 'Advance' }],
          { session }
        );
      }
      await recalcPaid(booking, session);
      await createDocuments(staged, { ownerType: 'booking', ownerId: booking._id, hotelId }, session);
      if (options.afterCreate) await options.afterCreate({ booking, guest, session });

      if (enquiry) {
        enquiry.status = 'Converted';
        enquiry.bookingId = booking._id;
        await enquiry.save({ session });
      }
      return booking._id;
    });

    return getBookingById(bookingId);
  } catch (err) {
    await discardUploads(staged);
    throw err;
  }
}

const SCHEDULE_FIELDS = ['checkIn', 'checkOut', 'rooms'];

export async function updateBooking(id, input, files = []) {
  const owner = await Booking.findById(id, { hotelId: 1 });
  if (!owner) throw ApiError.notFound('Booking not found');

  const staged = await stageUploads(files, { hotelId: owner.hotelId, ownerType: 'booking' });
  try {
    const bookingId = await bookingWrite(owner.hotelId, async (session) => {
      const booking = await Booking.findById(id).session(session || null);
      if (!booking) throw ApiError.notFound('Booking not found');
      if (booking.status === 'Cancelled') throw ApiError.conflict('Cancelled bookings cannot be edited');

      const changesSchedule = SCHEDULE_FIELDS.some((f) => input[f] !== undefined);
      if (booking.status === 'Checked-out' && changesSchedule) {
        throw ApiError.conflict('Dates and rooms of a checked-out booking cannot be changed');
      }

      const hotelId = booking.hotelId;

      const checkIn = input.checkIn ?? booking.checkIn;
      const checkOut = input.checkOut ?? booking.checkOut;
      assertDates(checkIn, checkOut);

      if (changesSchedule) {
        const existing = new Map(booking.rooms.map((r) => [String(r.roomId), { type: r.type, ratePerNight: r.ratePerNight }]));
        const requested = input.rooms ?? booking.rooms.map((r) => ({ roomId: r.roomId }));
        const rooms = await loadRooms(hotelId, requested, session, existing);
        await lockRooms(rooms.map((r) => r.doc._id), session);
        // A checked-in guest keeps rooms they already occupy even if those went into maintenance;
        // newly added rooms are checked normally
        const held = new Set(booking.rooms.map((r) => String(r.roomId)));
        const toCheck =
          booking.status === 'Checked-in'
            ? rooms.map((r) => (held.has(String(r.doc._id)) ? { ...r, doc: { ...r.doc.toObject(), status: 'Available' } } : r))
            : rooms;
        await assertBookable({ hotelId, rooms: toCheck, checkIn, checkOut, excludeBookingId: booking._id, session });
        booking.rooms = rooms.map((r) => r.snapshot);
        booking.checkIn = checkIn;
        booking.checkOut = checkOut;
      }

      for (const key of ['adults', 'children', 'extraCharges', 'discount', 'gstPercent', 'source', 'notes']) {
        if (input[key] !== undefined) booking[key] = input[key];
      }

      booking.nights = nightsBetween(booking.checkIn, booking.checkOut);
      Object.assign(
        booking,
        computeTotals({
          rooms: booking.rooms,
          nights: booking.nights,
          extraCharges: booking.extraCharges,
          discount: booking.discount,
          gstPercent: booking.gstPercent,
        })
      );

      // All checks passed: now write
      if (input.guestId || input.guest) {
        const guest = await resolveGuest({ hotelId, guestId: input.guestId, guest: input.guest }, session);
        booking.guestId = guest._id;
      }
      await recalcPaid(booking, session);
      await createDocuments(staged, { ownerType: 'booking', ownerId: booking._id, hotelId }, session);
      return booking._id;
    });

    return getBookingById(bookingId);
  } catch (err) {
    await discardUploads(staged);
    throw err;
  }
}

// ---------------------------------------------------------------- status transitions

const TRANSITIONS = {
  checkin: { from: ['Booked'], to: 'Checked-in', verb: 'check in' },
  checkout: { from: ['Checked-in'], to: 'Checked-out', verb: 'check out' },
  cancel: { from: ['Booked'], to: 'Cancelled', verb: 'cancel' },
};

export async function transitionBooking(id, action, { reason } = {}) {
  const rule = TRANSITIONS[action];
  const now = new Date();
  const set = { status: rule.to };
  if (action === 'checkin') set.actualCheckIn = now;
  if (action === 'checkout') set.actualCheckOut = now;
  if (action === 'cancel') Object.assign(set, { cancelledAt: now, cancelReason: reason || '' });

  if (action === 'checkin') {
    const current = await Booking.findById(id, { rooms: 1 });
    if (current) {
      const blocked = await Room.find({ _id: { $in: current.rooms.map((r) => r.roomId) }, status: 'Maintenance' });
      if (blocked.length) {
        throw ApiError.conflict(`Room ${blocked.map((r) => r.roomNumber).join(', ')} is under maintenance`);
      }
    }
  }

  // Conditional update: only succeeds from an allowed status, even under concurrency
  const updated = await Booking.findOneAndUpdate(
    { _id: id, status: { $in: rule.from } },
    { $set: set },
    { new: true }
  ).populate(BOOKING_POPULATE);
  if (updated) return updated;

  const existing = await Booking.findById(id, { status: 1 });
  if (!existing) throw ApiError.notFound('Booking not found');
  const hint =
    action === 'cancel' && existing.status === 'Checked-in' ? ' Checked-in guests must be checked out instead.' : '';
  throw ApiError.conflict(`Cannot ${rule.verb} a booking that is "${existing.status}".${hint}`);
}

// ---------------------------------------------------------------- payments

export async function addPayment(bookingId, data) {
  const owner = await Booking.findById(bookingId, { hotelId: 1 });
  if (!owner) throw ApiError.notFound('Booking not found');
  return bookingWrite(owner.hotelId, async (session) => {
    const booking = await Booking.findById(bookingId).session(session || null);
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.status === 'Cancelled') throw ApiError.conflict('Cannot add a payment to a cancelled booking');

    const [payment] = await Payment.create(
      [{ hotelId: booking.hotelId, bookingId: booking._id, date: data.date || new Date(), ...data }],
      { session }
    );
    await recalcPaid(booking, session);
    return { payment, booking };
  });
}

export async function removePayment(paymentId) {
  const owner = await Payment.findById(paymentId, { hotelId: 1 });
  if (!owner) throw ApiError.notFound('Payment not found');
  return bookingWrite(owner.hotelId, async (session) => {
    const payment = await Payment.findById(paymentId).session(session || null);
    if (!payment) throw ApiError.notFound('Payment not found');
    await Payment.deleteOne({ _id: payment._id }, { session });
    const booking = await Booking.findById(payment.bookingId).session(session || null);
    if (booking) await recalcPaid(booking, session);
    return { payment, booking };
  });
}
