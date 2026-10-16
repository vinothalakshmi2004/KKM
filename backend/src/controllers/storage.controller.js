import { ensureHotel } from '../services/hotel.service.js';
import { deleteMonthExpenses, deleteMonthIncome, getMonthExpenses, getMonthIncome } from '../services/bookingArchive.service.js';
import { countUnusedGuests, deleteUnusedGuests, monthsOverview, storageSummary } from '../services/storage.service.js';
import { emitToHotel } from '../sockets/index.js';
import { ok } from '../utils/http.js';

export async function summary(req, res) {
  await ensureHotel(req.query.hotelId);
  res.set('Cache-Control', 'no-store');
  const [usage, months, unusedGuests] = await Promise.all([
    storageSummary(req.query.hotelId),
    monthsOverview(req.query.hotelId),
    countUnusedGuests(req.query.hotelId),
  ]);
  ok(res, { ...usage, months, unusedGuests });
}

export async function incomeMonth(req, res) {
  await ensureHotel(req.query.hotelId);
  res.set('Cache-Control', 'no-store');
  ok(res, await getMonthIncome(req.query));
}

export async function incomeDelete(req, res) {
  await ensureHotel(req.query.hotelId);
  const result = await deleteMonthIncome(req.query);
  console.log(`[storage] ${result.label}: ${result.deleted} payment(s) deleted for hotel ${req.query.hotelId} by admin ${req.user._id}`);
  if (result.deleted) emitToHotel(req.query.hotelId, 'payment:deleted', { action: 'bulk-deleted', period: result.period });
  ok(res, result, `${result.deleted} payment(s) from ${result.label} deleted`);
}

export async function expensesMonth(req, res) {
  await ensureHotel(req.query.hotelId);
  res.set('Cache-Control', 'no-store');
  ok(res, await getMonthExpenses(req.query));
}

export async function expensesDelete(req, res) {
  await ensureHotel(req.query.hotelId);
  const result = await deleteMonthExpenses(req.query);
  console.log(`[storage] ${result.label}: ${result.deleted} expense(s) deleted for hotel ${req.query.hotelId} by admin ${req.user._id}`);
  if (result.deleted) emitToHotel(req.query.hotelId, 'expense:updated', { action: 'bulk-deleted', period: result.period });
  ok(res, result, `${result.deleted} expense(s) from ${result.label} deleted`);
}

export async function removeUnusedGuests(req, res) {
  await ensureHotel(req.query.hotelId);
  const result = await deleteUnusedGuests(req.query.hotelId);
  console.log(`[storage] ${result.deleted} unused guest(s) deleted for hotel ${req.query.hotelId} by admin ${req.user._id}`);
  if (result.deleted) emitToHotel(req.query.hotelId, 'guest:updated', { action: 'bulk-deleted' });
  ok(res, result, `${result.deleted} unused guest(s) deleted`);
}
