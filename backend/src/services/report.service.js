import mongoose from 'mongoose';
import { Booking, Counter, Expense, Payment, Room, Enquiry } from '../models/index.js';
import { TZ, dayjs, nowTz, todayRange } from '../utils/date.js';
import { round2 } from '../utils/http.js';
import { getRoomBoard } from './availability.service.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function incomeIn(hotelId, start, end) {
  const [res] = await Payment.aggregate([
    { $match: { hotelId: oid(hotelId), date: { $gte: start, $lte: end } } },
    {
      $facet: {
        total: [{ $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }],
        byMode: [
          { $group: { _id: '$mode', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { amount: -1 } },
          { $project: { _id: 0, mode: '$_id', amount: { $round: ['$amount', 2] }, count: 1 } },
        ],
      },
    },
  ]);
  return { total: round2(res.total[0]?.amount), count: res.total[0]?.count || 0, byMode: res.byMode };
}

async function expensesIn(hotelId, start, end) {
  const [res] = await Expense.aggregate([
    { $match: { hotelId: oid(hotelId), date: { $gte: start, $lte: end } } },
    {
      $facet: {
        total: [{ $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }],
        byCategory: [
          { $group: { _id: '$categoryName', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { amount: -1 } },
          { $project: { _id: 0, category: '$_id', amount: { $round: ['$amount', 2] }, count: 1 } },
        ],
      },
    },
  ]);
  return { total: round2(res.total[0]?.amount), count: res.total[0]?.count || 0, byCategory: res.byCategory };
}

/**
 * Occupancy = room-nights sold / room-nights available in the range.
 * Stays are clipped to the range; nights are counted by calendar date in the hotel timezone.
 */
async function occupancyIn(hotelId, start, end) {
  const endExclusive = dayjs(end).tz(TZ).add(1, 'day').startOf('day').toDate();
  const days = Math.max(1, dayjs(endExclusive).diff(dayjs(start), 'day'));

  const [roomCount, [sold]] = await Promise.all([
    Room.countDocuments({ hotelId }),
    Booking.aggregate([
      {
        $match: {
          hotelId: oid(hotelId),
          status: { $in: ['Booked', 'Checked-in', 'Checked-out'] },
          checkIn: { $lt: endExclusive },
          checkOut: { $gt: start },
        },
      },
      {
        $project: {
          roomCount: { $size: '$rooms' },
          inside: { $and: [{ $gte: ['$checkIn', start] }, { $lte: ['$checkOut', endExclusive] }] },
          clipped: {
            $dateDiff: {
              startDate: { $max: ['$checkIn', start] },
              endDate: { $min: ['$checkOut', endExclusive] },
              unit: 'day',
              timezone: TZ,
            },
          },
        },
      },
      // A same-day stay that lies wholly inside the range still counts as one night
      { $project: { roomNights: { $multiply: ['$roomCount', { $cond: ['$inside', { $max: [1, '$clipped'] }, '$clipped'] }] } } },
      { $group: { _id: null, roomNights: { $sum: '$roomNights' } } },
    ]),
  ]);

  const available = roomCount * days;
  const roomNights = sold?.roomNights || 0;
  return {
    roomNightsSold: roomNights,
    roomNightsAvailable: available,
    occupancyPercent: available ? Math.min(100, round2((roomNights / available) * 100)) : 0,
  };
}

export async function getSummary(hotelId, { start, end }) {
  const [income, expenses, occupancy] = await Promise.all([
    incomeIn(hotelId, start, end),
    expensesIn(hotelId, start, end),
    occupancyIn(hotelId, start, end),
  ]);
  return {
    from: start,
    to: end,
    income: income.total,
    expenses: expenses.total,
    profit: round2(income.total - expenses.total),
    expensesByCategory: expenses.byCategory,
    paymentsByMode: income.byMode,
    occupancyPercent: occupancy.occupancyPercent,
    roomNightsSold: occupancy.roomNightsSold,
    roomNightsAvailable: occupancy.roomNightsAvailable,
    paymentCount: income.count,
    expenseCount: expenses.count,
  };
}

/** Sum a collection per calendar month (hotel timezone). Returns Map "YYYY-M" → amount. */
async function monthlyTotals(Model, hotelId, start, end) {
  const rows = await Model.aggregate([
    { $match: { hotelId: oid(hotelId), date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { y: { $year: { date: '$date', timezone: TZ } }, m: { $month: { date: '$date', timezone: TZ } } },
        amount: { $sum: '$amount' },
      },
    },
  ]);
  return new Map(rows.map((r) => [`${r._id.y}-${r._id.m}`, round2(r.amount)]));
}

async function monthSeries(hotelId, first, count) {
  const start = first.startOf('month').toDate();
  const end = first.add(count - 1, 'month').endOf('month').toDate();
  const [income, expenses] = await Promise.all([
    monthlyTotals(Payment, hotelId, start, end),
    monthlyTotals(Expense, hotelId, start, end),
  ]);
  return Array.from({ length: count }, (_, i) => {
    const d = first.add(i, 'month');
    const key = `${d.year()}-${d.month() + 1}`;
    const inc = income.get(key) || 0;
    const exp = expenses.get(key) || 0;
    return { year: d.year(), month: d.month() + 1, label: MONTH_LABELS[d.month()], income: inc, expenses: exp, profit: round2(inc - exp) };
  });
}

export async function getYearly(hotelId, year) {
  const first = dayjs.tz(`${year}-01-01`, TZ);
  const months = await monthSeries(hotelId, first, 12);
  const totals = months.reduce(
    (acc, m) => ({ income: acc.income + m.income, expenses: acc.expenses + m.expenses }),
    { income: 0, expenses: 0 }
  );
  return {
    year,
    months,
    totals: { income: round2(totals.income), expenses: round2(totals.expenses), profit: round2(totals.income - totals.expenses) },
  };
}

export async function getDashboard(hotelId) {
  const now = nowTz();
  const monthStart = now.startOf('month').toDate();
  const monthEnd = now.endOf('month').toDate();
  const today = todayRange();

  const hid = new mongoose.Types.ObjectId(String(hotelId));
  const [roomBoard, income, expenses, checkIns, checkOuts, last6, newEnquiries, byStatus, online, bookedThisMonth, everMade] = await Promise.all([
    getRoomBoard(hotelId),
    incomeIn(hotelId, monthStart, monthEnd),
    expensesIn(hotelId, monthStart, monthEnd),
    Booking.find({ hotelId, status: { $in: ['Booked', 'Checked-in'] }, checkIn: { $gte: today.start, $lte: today.end } })
      .populate('guestId', 'name phone')
      .sort({ checkIn: 1 }),
    Booking.find({ hotelId, status: { $in: ['Checked-in', 'Checked-out'] }, checkOut: { $gte: today.start, $lte: today.end } })
      .populate('guestId', 'name phone')
      .sort({ checkOut: 1 }),
    monthSeries(hotelId, now.subtract(5, 'month'), 6),
    Enquiry.countDocuments({ hotelId, status: 'New' }),
    // Every booking so far, by its current status
    Booking.aggregate([{ $match: { hotelId: hid } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.countDocuments({ hotelId, source: 'Online' }),
    Booking.countDocuments({ hotelId, createdAt: { $gte: monthStart, $lte: monthEnd } }),
    // Bookings ever made: the booking-number counters ("booking:<hotel>:<year>") only go up,
    // so this keeps counting bookings that were later deleted in Data & Storage
    Counter.aggregate([{ $match: { _id: { $regex: `^booking:${String(hotelId)}:` } } }, { $group: { _id: null, seq: { $sum: '$seq' } } }]),
  ]);
  const statusCount = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));

  const countBy = (status) => roomBoard.filter((r) => r.liveStatus === status).length;

  return {
    counts: {
      totalRooms: roomBoard.length,
      occupied: countBy('Occupied'),
      reserved: countBy('Reserved'),
      available: countBy('Available'),
      maintenance: countBy('Maintenance'),
      todayCheckIns: checkIns.length,
      todayCheckOuts: checkOuts.length,
      newEnquiries,
    },
    thisMonth: {
      income: income.total,
      expenses: expenses.total,
      profit: round2(income.total - expenses.total),
      expensesByCategory: expenses.byCategory,
      paymentsByMode: income.byMode,
    },
    bookings: {
      sinceStart: Math.max(everMade[0]?.seq || 0, byStatus.reduce((sum, s) => sum + s.count, 0)),
      total: byStatus.reduce((sum, s) => sum + s.count, 0),
      booked: statusCount.Booked || 0,
      checkedIn: statusCount['Checked-in'] || 0,
      checkedOut: statusCount['Checked-out'] || 0,
      cancelled: statusCount.Cancelled || 0,
      online,
      thisMonth: bookedThisMonth,
    },
    last6Months: last6,
    todayCheckIns: checkIns,
    todayCheckOuts: checkOuts,
    roomBoard,
  };
}
