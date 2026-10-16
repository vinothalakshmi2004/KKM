import { ensureHotel } from '../services/hotel.service.js';
import { getDashboard, getSummary, getYearly } from '../services/report.service.js';
import { ApiError } from '../utils/ApiError.js';
import { nowTz, resolveRange } from '../utils/date.js';
import { ok } from '../utils/http.js';

export async function summary(req, res) {
  const { hotelId, from, to } = req.query;
  await ensureHotel(hotelId);
  const range = resolveRange(from, to);
  if (range.end < range.start) throw ApiError.badRequest('"to" must be on or after "from"');
  ok(res, await getSummary(hotelId, range));
}

export async function yearly(req, res) {
  const { hotelId, year } = req.query;
  await ensureHotel(hotelId);
  ok(res, await getYearly(hotelId, year ?? nowTz().year()));
}

export async function dashboard(req, res) {
  await ensureHotel(req.query.hotelId);
  ok(res, await getDashboard(req.query.hotelId));
}
