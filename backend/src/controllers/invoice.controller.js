import { Invoice } from '../models/index.js';
import { ensureHotel } from '../services/hotel.service.js';
import { cancelInvoice, createInvoice, listFilter, withOutdatedFlag } from '../services/invoice.service.js';
import { renderInvoicePdf } from '../services/invoicePdf.service.js';
import { emitToHotel } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { created, getPaging, ok, paged, round2 } from '../utils/http.js';

export async function list(req, res) {
  await ensureHotel(req.query.hotelId);
  const paging = getPaging(req.query);
  const filter = listFilter(req.query);

  const [items, total, [sum]] = await Promise.all([
    Invoice.find(filter, { lines: 0, payments: 0, hotel: 0 }).sort({ issuedAt: -1 }).skip(paging.skip).limit(paging.limit),
    Invoice.countDocuments(filter),
    // Total of issued (not cancelled) invoices matching the filters, across all pages
    Invoice.aggregate([{ $match: { ...filter, status: 'Issued' } }, { $group: { _id: null, amount: { $sum: '$grandTotal' } } }]),
  ]);
  ok(res, { ...paged(items, total, paging), totalIssued: round2(sum?.amount) });
}

export async function get(req, res) {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  ok(res, await withOutdatedFlag(invoice));
}

export async function create(req, res) {
  const invoice = await createInvoice(req.body.bookingId);
  emitToHotel(invoice.hotelId, 'invoice:created', { invoiceId: invoice._id, bookingId: invoice.bookingId });
  created(res, invoice, `Invoice ${invoice.invoiceNo} issued`);
}

export async function cancel(req, res) {
  const invoice = await cancelInvoice(req.params.id, req.body.reason);
  emitToHotel(invoice.hotelId, 'invoice:updated', { invoiceId: invoice._id, bookingId: invoice.bookingId });
  ok(res, invoice, `Invoice ${invoice.invoiceNo} cancelled`);
}

export async function pdf(req, res) {
  const invoice = await Invoice.findById(req.params.id).lean();
  if (!invoice) throw ApiError.notFound('Invoice not found');
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${invoice.invoiceNo}.pdf"`);
  res.set('Cache-Control', 'private, no-store');
  renderInvoicePdf(invoice, res);
}
