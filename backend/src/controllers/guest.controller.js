import { Booking, Document, Guest } from '../models/index.js';
import { ensureHotel } from '../services/hotel.service.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, getPaging, ok, created, paged } from '../utils/http.js';
import { parseDate } from '../utils/date.js';

/** Filter matching name, phone (by digits) or email. */
export function guestSearchFilter(search) {
  const text = new RegExp(escapeRegex(search), 'i');
  const or = [{ name: text }, { email: text }];
  const digits = search.replace(/\D/g, '');
  if (digits.length >= 3) or.push({ phone: new RegExp(escapeRegex(digits)) });
  return { $or: or };
}

export async function list(req, res) {
  const { hotelId, search } = req.query;
  await ensureHotel(hotelId);
  const paging = getPaging(req.query);
  const filter = { hotelId, ...(search ? guestSearchFilter(search) : {}) };

  const [items, total] = await Promise.all([
    Guest.find(filter).sort({ updatedAt: -1 }).skip(paging.skip).limit(paging.limit),
    Guest.countDocuments(filter),
  ]);
  ok(res, paged(items, total, paging));
}

/** CSV export: all guests or filtered by first-seen date (createdAt). */
export async function exportCsv(req, res) {
  const { hotelId, from, to, search } = req.query;
  await ensureHotel(hotelId);

  const filter = { hotelId };
  if (search) Object.assign(filter, guestSearchFilter(search));
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = parseDate(from);
    if (to) {
      const toDate = parseDate(to);
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = toDate;
    }
  }

  const guests = await Guest.find(filter).sort({ createdAt: -1 }).lean();

  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = ['Name', 'Phone', 'Email', 'Address', 'ID Proof Type', 'ID Proof Number', 'Notes', 'Added On'];
  const rows = guests.map((g) => [
    g.name,
    g.phone,
    g.email || '',
    g.address || '',
    g.idProofType || '',
    g.idProofNumber || '',
    g.notes || '',
    g.createdAt ? new Date(g.createdAt).toLocaleDateString('en-IN') : '',
  ].map(escape).join(','));

  const csv = [header.join(','), ...rows].join('\r\n');
  const filename = `guests_${hotelId}_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
}

export async function create(req, res) {
  const { hotelId, phone } = req.body;
  await ensureHotel(hotelId);
  const existing = await Guest.findOne({ hotelId, phone });
  if (existing) {
    throw ApiError.conflict('A guest with this phone number already exists', [
      { field: 'phone', message: 'Already registered', guestId: existing._id },
    ]);
  }
  created(res, await Guest.create(req.body), 'Guest added');
}

export async function get(req, res) {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw ApiError.notFound('Guest not found');

  const [bookings, documents] = await Promise.all([
    Booking.find({ guestId: guest._id }).sort({ checkIn: -1 }).limit(100),
    Document.find({ ownerType: 'guest', ownerId: guest._id }).sort({ uploadedAt: -1 }),
  ]);
  // ID proofs are often uploaded while booking, so show those here too
  const bookingNo = new Map(bookings.map((b) => [String(b._id), b.bookingNo]));
  const bookingDocuments = (
    await Document.find({ ownerType: 'booking', ownerId: { $in: bookings.map((b) => b._id) } }).sort({ uploadedAt: -1 })
  ).map((d) => ({ ...d.toJSON(), bookingNo: bookingNo.get(String(d.ownerId)) }));
  const totals = bookings
    .filter((b) => b.status !== 'Cancelled')
    .reduce((acc, b) => ({ stays: acc.stays + 1, spent: acc.spent + b.paidAmount }), { stays: 0, spent: 0 });

  ok(res, { ...guest.toJSON(), bookings, documents, bookingDocuments, totals });
}

export async function update(req, res) {
  const guest = await Guest.findById(req.params.id);
  if (!guest) throw ApiError.notFound('Guest not found');

  if (req.body.phone && req.body.phone !== guest.phone) {
    const clash = await Guest.exists({ hotelId: guest.hotelId, phone: req.body.phone, _id: { $ne: guest._id } });
    if (clash) throw ApiError.conflict('Another guest already uses this phone number');
  }
  Object.assign(guest, req.body);
  await guest.save();
  ok(res, guest, 'Guest updated');
}
