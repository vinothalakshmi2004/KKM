import { Booking, Room, ACTIVE_STATUSES } from '../models/index.js';
import { todayRange } from '../utils/date.js';

/**
 * Active bookings (Booked / Checked-in) that hold any of `roomIds` during [checkIn, checkOut).
 * Overlap rule: existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn.
 */
export function findConflicts({ hotelId, roomIds, checkIn, checkOut, excludeBookingId, session }) {
  const filter = {
    hotelId,
    status: { $in: ACTIVE_STATUSES },
    'rooms.roomId': { $in: roomIds },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };
  return Booking.find(filter, { bookingNo: 1, rooms: 1, checkIn: 1, checkOut: 1 }).session(session || null);
}

/**
 * Rooms free for the whole period: not in Maintenance and no overlapping active booking.
 * Every room can be booked as AC or Non-AC, so there is no type filter.
 */
export async function getAvailableRooms({ hotelId, checkIn, checkOut }) {
  const roomFilter = { hotelId, status: { $ne: 'Maintenance' } };

  const busyRoomIds = await Booking.distinct('rooms.roomId', {
    hotelId,
    status: { $in: ACTIVE_STATUSES },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  });

  roomFilter._id = { $nin: busyRoomIds };
  return Room.find(roomFilter).collation({ locale: 'en', numericOrdering: true }).sort({ roomNumber: 1 });
}

/**
 * Live state of every room right now:
 * Occupied (checked-in booking), Reserved (Booked, arriving today), Maintenance, else Available.
 */
export async function getRoomBoard(hotelId) {
  const { start, end } = todayRange();
  const [rooms, inHouse, arrivals] = await Promise.all([
    Room.find({ hotelId }).collation({ locale: 'en', numericOrdering: true }).sort({ roomNumber: 1 }).lean(),
    Booking.find({ hotelId, status: 'Checked-in' }, { bookingNo: 1, rooms: 1, guestId: 1, checkIn: 1, checkOut: 1 })
      .populate('guestId', 'name phone')
      .lean(),
    Booking.find(
      { hotelId, status: 'Booked', checkIn: { $gte: start, $lte: end } },
      { bookingNo: 1, rooms: 1, guestId: 1, checkIn: 1, checkOut: 1 }
    )
      .populate('guestId', 'name phone')
      .lean(),
  ]);

  // roomId → { booking, type } (type = AC / Non-AC for this stay)
  const byRoom = (bookings) => {
    const map = new Map();
    for (const b of bookings) for (const r of b.rooms) map.set(String(r.roomId), { ...b, roomType: r.type });
    return map;
  };
  const occupied = byRoom(inHouse);
  const reserved = byRoom(arrivals);

  const summary = (b) =>
    b && {
      _id: b._id,
      bookingNo: b.bookingNo,
      type: b.roomType,
      guest: b.guestId ? { _id: b.guestId._id, name: b.guestId.name, phone: b.guestId.phone } : null,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
    };

  return rooms.map((room) => {
    const id = String(room._id);
    let liveStatus = 'Available';
    let booking = null;
    if (occupied.has(id)) {
      liveStatus = 'Occupied';
      booking = summary(occupied.get(id));
    } else if (room.status === 'Maintenance') {
      liveStatus = 'Maintenance';
    } else if (reserved.has(id)) {
      liveStatus = 'Reserved';
      booking = summary(reserved.get(id));
    }
    return { ...room, liveStatus, booking };
  });
}
