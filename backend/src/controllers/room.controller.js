import { Booking, Room, ACTIVE_STATUSES } from '../models/index.js';
import { getAvailableRooms, getRoomBoard } from '../services/availability.service.js';
import { bookingWrite } from '../services/booking.service.js';
import { ensureHotel } from '../services/hotel.service.js';
import { emitToHotel } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, getPaging, ok, created, paged } from '../utils/http.js';

const NUMERIC_SORT = { locale: 'en', numericOrdering: true };

export async function list(req, res) {
  const { hotelId, status, search } = req.query;
  await ensureHotel(hotelId);
  const paging = getPaging(req.query);

  const filter = { hotelId };
  if (status) filter.status = status;
  if (search) filter.roomNumber = new RegExp(escapeRegex(search), 'i');

  const [rooms, total, board] = await Promise.all([
    Room.find(filter).collation(NUMERIC_SORT).sort({ roomNumber: 1 }).skip(paging.skip).limit(paging.limit),
    Room.countDocuments(filter),
    getRoomBoard(hotelId),
  ]);

  // Attach live state (Occupied / Reserved / Maintenance / Available)
  const live = new Map(board.map((r) => [String(r._id), r]));
  const items = rooms.map((room) => {
    const state = live.get(String(room._id));
    return { ...room.toJSON(), liveStatus: state?.liveStatus || room.status, currentBooking: state?.booking || null };
  });
  ok(res, paged(items, total, paging));
}

export async function available(req, res) {
  const { hotelId, checkIn, checkOut } = req.query;
  await ensureHotel(hotelId);
  if (checkOut <= checkIn) throw ApiError.badRequest('Check-out must be after check-in');
  ok(res, await getAvailableRooms({ hotelId, checkIn, checkOut }));
}

export async function create(req, res) {
  await ensureHotel(req.body.hotelId);
  const room = await Room.create(req.body);
  emitToHotel(room.hotelId, 'room:updated', { action: 'created', room });
  created(res, room, 'Room added');
}

export async function bulkCreate(req, res) {
  const { hotelId, from, to, prefix = '', ...fields } = req.body;
  await ensureHotel(hotelId);

  const numbers = Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);
  const existing = new Set(
    (await Room.find({ hotelId, roomNumber: { $in: numbers } }, { roomNumber: 1 })).map((r) => r.roomNumber)
  );
  const toCreate = numbers.filter((n) => !existing.has(n));

  const rooms = toCreate.length
    ? await Room.insertMany(toCreate.map((roomNumber) => ({ ...fields, hotelId, roomNumber })))
    : [];
  if (rooms.length) emitToHotel(hotelId, 'room:updated', { action: 'bulk-created', count: rooms.length });

  created(
    res,
    { created: rooms, skipped: [...existing] },
    `${rooms.length} room(s) added${existing.size ? `, ${existing.size} skipped (already exist)` : ''}`
  );
}

export async function updatePrices(req, res) {
  const { hotelId, roomIds, acPrice, nonAcPrice } = req.body;
  await ensureHotel(hotelId);
  const filter = { hotelId, ...(roomIds?.length ? { _id: { $in: roomIds } } : {}) };
  const set = {
    ...(acPrice !== undefined ? { acPrice } : {}),
    ...(nonAcPrice !== undefined ? { nonAcPrice } : {}),
  };
  const { modifiedCount, matchedCount } = await Room.updateMany(filter, { $set: set });
  emitToHotel(hotelId, 'room:updated', { action: 'prices', count: modifiedCount });
  ok(res, { matched: matchedCount, modified: modifiedCount }, `Prices updated for ${matchedCount} room(s)`);
}

export async function update(req, res) {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');
  Object.assign(room, req.body);
  await room.save();
  emitToHotel(room.hotelId, 'room:updated', { action: 'updated', room });
  ok(res, room, 'Room updated');
}

export async function remove(req, res) {
  const found = await Room.findById(req.params.id, { hotelId: 1 });
  if (!found) throw ApiError.notFound('Room not found');

  // Same serialisation as bookings, so a booking can't be made for a room while it is deleted
  const room = await bookingWrite(found.hotelId, async (session) => {
    const current = await Room.findById(found._id).session(session || null);
    if (!current) throw ApiError.notFound('Room not found');
    const blocking = await Booking.countDocuments({
      'rooms.roomId': current._id,
      status: { $in: ACTIVE_STATUSES },
    }).session(session || null);
    if (blocking) {
      throw ApiError.conflict(
        `Room ${current.roomNumber} has ${blocking} active or upcoming booking(s). Cancel or complete them first, or set the room to Maintenance.`
      );
    }
    await Room.deleteOne({ _id: current._id }, { session });
    return current;
  });

  emitToHotel(room.hotelId, 'room:updated', { action: 'deleted', roomId: room._id });
  ok(res, null, 'Room deleted');
}
