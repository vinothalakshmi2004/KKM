import { Booking, Room } from '../models/index.js';
import { TZ, dayjs, startOfDay } from '../utils/date.js';

export const MAX_CALENDAR_DAYS = 62;

const naturalSort = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * Calendar data for one hotel and an inclusive date range (YYYY-MM-DD, hotel timezone).
 * Two lean queries (rooms, overlapping bookings); occupancy is computed in memory.
 *
 * A booking occupies the nights from its check-in date up to (not including) its check-out
 * date, minimum one night, the same rule used for billing (nightsBetween).
 */
export async function getCalendar({ hotelId, from, to, type, includeCancelled = false }) {
  const first = dayjs(startOfDay(from)).tz(TZ);
  const days = dayjs(startOfDay(to)).tz(TZ).diff(first, 'day') + 1;
  const rangeStart = first.toDate();
  const rangeEnd = first.add(days, 'day').toDate(); // exclusive

  const [rooms, bookings] = await Promise.all([
    Room.find({ hotelId }, { roomNumber: 1, floor: 1, status: 1, acPrice: 1, nonAcPrice: 1 }).lean(),
    Booking.find(
      {
        hotelId,
        checkIn: { $lt: rangeEnd },
        checkOut: { $gt: rangeStart },
        ...(includeCancelled ? {} : { status: { $ne: 'Cancelled' } }),
      },
      { bookingNo: 1, status: 1, checkIn: 1, checkOut: 1, nights: 1, rooms: 1, guestId: 1, grandTotal: 1, paidAmount: 1, balance: 1, source: 1, onlineRef: 1 }
    )
      .populate('guestId', 'name phone')
      .sort({ checkIn: 1 })
      .lean(),
  ]);

  // Floor, then room number, both in natural order ("2" < "10")
  rooms.sort((a, b) => naturalSort.compare(a.floor || '', b.floor || '') || naturalSort.compare(a.roomNumber, b.roomNumber));

  const dates = Array.from({ length: days }, (_, i) => first.add(i, 'day'));
  const dayIndex = (d) => dayjs(d).tz(TZ).startOf('day').diff(first, 'day');

  // Occupancy counts every non-cancelled booking, whatever the type filter
  const occupiedRooms = dates.map(() => new Set());
  const roomIds = new Set(rooms.map((r) => String(r._id)));
  for (const b of bookings) {
    if (b.status === 'Cancelled') continue;
    const startIdx = dayIndex(b.checkIn);
    const endIdx = Math.max(dayIndex(b.checkOut), startIdx + 1);
    for (let i = Math.max(0, startIdx); i < Math.min(days, endIdx); i += 1) {
      for (const r of b.rooms) if (roomIds.has(String(r.roomId))) occupiedRooms[i].add(String(r.roomId));
    }
  }

  const visible = type ? bookings.filter((b) => b.rooms.some((r) => r.type === type)) : bookings;

  return {
    from: first.format('YYYY-MM-DD'),
    to: first.add(days - 1, 'day').format('YYYY-MM-DD'),
    days,
    rooms: rooms.map((r) => ({
      _id: r._id,
      roomNumber: r.roomNumber,
      floor: r.floor || '',
      // Every room can be let as AC or Non-AC; the mode is chosen per booking
      type: 'AC / Non-AC',
      status: r.status,
      acPrice: r.acPrice,
      nonAcPrice: r.nonAcPrice,
    })),
    bookings: visible.map((b) => ({
      _id: b._id,
      bookingNo: b.bookingNo,
      status: b.status,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      rooms: b.rooms.map((r) => ({ roomId: r.roomId, roomNumber: r.roomNumber, type: r.type })),
      guest: b.guestId ? { _id: b.guestId._id, name: b.guestId.name, phone: b.guestId.phone } : null,
      grandTotal: b.grandTotal,
      paidAmount: b.paidAmount,
      balance: b.balance,
      source: b.source,
      onlineRef: b.onlineRef || null,
    })),
    occupancy: dates.map((d, i) => ({ date: d.format('YYYY-MM-DD'), occupied: occupiedRooms[i].size, totalRooms: rooms.length })),
  };
}
