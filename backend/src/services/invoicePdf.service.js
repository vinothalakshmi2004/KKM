import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TZ, dayjs } from '../utils/date.js';

// DejaVu Sans (free licence, bundled) has the ₹ glyph, which PDF's built-in fonts lack
const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'DejaVuSans.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf');

// Printed on white paper: dark text, brand gold only for the header line and table header
const GOLD = '#c9a45c';
const INK = '#111827';
const INK_SOFT = '#374151';
const RULE = '#d6d3cc';

const inr = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? dayjs(d).tz(TZ).format('DD MMM YYYY') : '—');
const fmtDateTime = (d) => (d ? dayjs(d).tz(TZ).format('DD MMM YYYY, hh:mm A') : '—');

// ---------------------------------------------------------------- amount in words (Indian system)
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}
function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
}
/** 125050.5 → "One Lakh Twenty Five Thousand Fifty Rupees and Fifty Paise Only" */
export function amountInWords(amount) {
  const value = Math.round(Math.abs(Number(amount) || 0) * 100);
  let rupees = Math.floor(value / 100);
  const paise = value % 100;
  const parts = [];
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000); rupees %= 100000;
  const thousand = Math.floor(rupees / 1000); rupees %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rupees) parts.push(threeDigits(rupees));
  const words = parts.join(' ') || 'Zero';
  return `${words} Rupee${words === 'One' ? '' : 's'}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
}

// ---------------------------------------------------------------- PDF

/** Write the invoice PDF to a writable stream (e.g. the HTTP response). */
export function renderInvoicePdf(inv, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true, // needed to write the footer on every page at the end
    margins: { top: 40, bottom: 50, left: 40, right: 40 },
    info: { Title: `Invoice ${inv.invoiceNo}`, Author: inv.hotel?.name || 'Hotel', Subject: `Booking ${inv.stay?.bookingNo || ''}` },
  });
  doc.registerFont('Regular', FONT_REGULAR);
  doc.registerFont('Bold', FONT_BOLD);
  doc.pipe(stream);

  const L = doc.page.margins.left;
  const R = doc.page.width - doc.page.margins.right;
  const W = R - L;
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 30;

  // Gold header line
  doc.rect(0, 0, doc.page.width, 8).fill(GOLD);

  // ---- Header: hotel (left) / invoice meta (right)
  let y = 32;
  const h = inv.hotel || {};
  doc.font('Bold').fontSize(18).fillColor(INK).text(h.name || 'Hotel', L, y, { width: W * 0.58 });
  let ly = doc.y + 4;
  doc.font('Regular').fontSize(9).fillColor(INK_SOFT);
  const hotelLines = [
    [h.address, h.area, h.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
    [h.phone && `Phone: ${h.phone}`, h.email && `Email: ${h.email}`].filter(Boolean).join('   '),
    h.gstin ? `GSTIN: ${h.gstin}` : '',
  ].filter(Boolean);
  hotelLines.forEach((line) => {
    doc.text(line, L, ly, { width: W * 0.58 });
    ly = doc.y + 1;
  });

  const metaX = L + W * 0.6;
  const metaW = W * 0.4;
  const title = inv.gstPercent > 0 ? 'TAX INVOICE' : 'INVOICE';
  doc.font('Bold').fontSize(16).fillColor(INK).text(title, metaX, y, { width: metaW, align: 'right' });
  let my = doc.y + 4;
  const meta = [
    ['Invoice No', inv.invoiceNo],
    ['Date', fmtDate(inv.issuedAt)],
    ['Booking No', inv.stay?.bookingNo || '—'],
    ['Status', inv.status],
  ];
  // Label column + value column (right-aligned "continued" text overlaps in pdfkit)
  const labelW = metaW * 0.42;
  meta.forEach(([k, v]) => {
    doc.font('Regular').fontSize(9).fillColor(INK_SOFT).text(k, metaX, my, { width: labelW, align: 'right' });
    doc.font('Bold').fontSize(9).fillColor(INK).text(String(v), metaX + labelW, my, { width: metaW - labelW, align: 'right' });
    my += 13;
  });

  y = Math.max(ly, my) + 12;
  doc.moveTo(L, y).lineTo(R, y).lineWidth(1.5).strokeColor(GOLD).stroke();
  y += 14;

  // ---- Bill to / Stay
  const colW = (W - 20) / 2;
  const g = inv.guest || {};
  const s = inv.stay || {};
  const block = (x, heading, rows) => {
    doc.font('Bold').fontSize(9).fillColor(INK_SOFT).text(heading.toUpperCase(), x, y, { width: colW, characterSpacing: 0.5 });
    let by = doc.y + 3;
    rows.filter(Boolean).forEach(([label, value], i) => {
      if (i === 0 && label === null) {
        doc.font('Bold').fontSize(11).fillColor(INK).text(value, x, by, { width: colW });
      } else {
        doc.font('Regular').fontSize(9).fillColor(INK_SOFT).text(label ? `${label}: ` : '', x, by, { width: colW, continued: !!label });
        doc.fillColor(INK).text(value || '—');
      }
      by = doc.y + 2;
    });
    return by;
  };
  const leftEnd = block(L, 'Billed to', [
    [null, g.name || 'Guest'],
    g.phone && ['Phone', g.phone],
    g.email && ['Email', g.email],
    g.address && ['Address', g.address],
    g.idProofType && ['ID', `${g.idProofType}${g.idProofNumber ? ` ${g.idProofNumber}` : ''}`],
  ]);
  const rightEnd = block(L + colW + 20, 'Stay', [
    ['Check-in', fmtDateTime(s.checkIn)],
    ['Check-out', fmtDateTime(s.checkOut)],
    ['Nights', String(s.nights ?? '—')],
    ['Guests', `${s.adults ?? 1} adult${(s.adults ?? 1) === 1 ? '' : 's'}${s.children ? `, ${s.children} child${s.children === 1 ? '' : 'ren'}` : ''}`],
  ]);
  y = Math.max(leftEnd, rightEnd) + 14;

  // ---- Line items table
  const cols = [
    { key: 'n', label: '#', w: 32, align: 'left' },
    { key: 'description', label: 'Description', w: W - 32 - 60 - 95 - 105, align: 'left' },
    { key: 'qty', label: 'Qty', w: 60, align: 'right' },
    { key: 'rate', label: 'Rate', w: 95, align: 'right' },
    { key: 'amount', label: 'Amount', w: 105, align: 'right' },
  ];
  const tableHeader = () => {
    doc.rect(L, y, W, 22).fill(GOLD);
    let x = L;
    cols.forEach((c) => {
      doc.font('Bold').fontSize(9).fillColor(INK).text(c.label, x + 6, y + 7, { width: c.w - 12, align: c.align });
      x += c.w;
    });
    y += 22;
  };
  tableHeader();

  (inv.lines || []).forEach((line, i) => {
    const cells = { n: String(i + 1), description: line.description, qty: String(line.qty), rate: inr(line.rate), amount: inr(line.amount) };
    doc.font('Regular').fontSize(9);
    const rowH = Math.max(20, doc.heightOfString(cells.description, { width: cols[1].w - 12 }) + 10);
    if (y + rowH > bottomLimit()) {
      doc.addPage();
      y = doc.page.margins.top;
      tableHeader();
    }
    let x = L;
    doc.font('Regular').fontSize(9); // the repeated table header leaves Bold selected
    cols.forEach((c) => {
      doc.fillColor(INK).text(cells[c.key], x + 6, y + 5, { width: c.w - 12, align: c.align });
      x += c.w;
    });
    y += rowH;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(RULE).stroke();
  });

  // ---- Totals
  y += 10;
  const totals = [
    ['Subtotal', inr(inv.subtotal)],
    inv.discount > 0 && ['Discount', `− ${inr(inv.discount)}`],
    ['Taxable value', inr(inv.taxableValue)],
    inv.gstPercent > 0 && [`CGST @ ${inv.gstPercent / 2}%`, inr(inv.cgst)],
    inv.gstPercent > 0 && [`SGST @ ${inv.gstPercent / 2}%`, inr(inv.sgst)],
  ].filter(Boolean);
  const tX = L + W * 0.52;
  const tW = W * 0.48;
  if (y + 24 * (totals.length + 4) > bottomLimit()) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  const totalsTop = y;
  totals.forEach(([k, v]) => {
    doc.font('Regular').fontSize(9.5).fillColor(INK_SOFT).text(k, tX, y, { width: tW * 0.55 });
    doc.fillColor(INK).text(v, tX + tW * 0.55, y, { width: tW * 0.45, align: 'right' });
    y += 16;
  });
  doc.moveTo(tX, y).lineTo(R, y).lineWidth(1).strokeColor(INK).stroke();
  y += 6;
  doc.font('Bold').fontSize(12).fillColor(INK).text('Grand Total', tX, y, { width: tW * 0.55 });
  doc.text(inr(inv.grandTotal), tX + tW * 0.55, y, { width: tW * 0.45, align: 'right' });
  y += 22;
  [['Paid', inr(inv.paidAmount)], ['Balance due', inr(inv.balance)]].forEach(([k, v]) => {
    doc.font(k === 'Balance due' ? 'Bold' : 'Regular').fontSize(9.5).fillColor(INK).text(k, tX, y, { width: tW * 0.55 });
    doc.text(v, tX + tW * 0.55, y, { width: tW * 0.45, align: 'right' });
    y += 16;
  });

  // Amount in words (left of totals block, aligned with its top)
  doc.font('Bold').fontSize(9).fillColor(INK_SOFT).text('AMOUNT IN WORDS', L, totalsTop, { width: W * 0.48 });
  doc.font('Regular').fontSize(9.5).fillColor(INK).text(amountInWords(inv.grandTotal), L, doc.y + 3, { width: W * 0.48 });
  y = Math.max(y, doc.y + 4);

  // ---- Payments received
  if (inv.payments?.length) {
    y += 14;
    if (y + 40 + inv.payments.length * 15 > bottomLimit()) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.font('Bold').fontSize(9).fillColor(INK_SOFT).text('PAYMENTS RECEIVED', L, y);
    y = doc.y + 4;
    inv.payments.forEach((p) => {
      doc.font('Regular').fontSize(9).fillColor(INK)
        .text(`${fmtDate(p.date)}   ${p.mode}${p.note ? ` · ${p.note}` : ''}`, L, y, { width: W * 0.7 });
      doc.text(inr(p.amount), L + W * 0.7, y, { width: W * 0.3, align: 'right' });
      y += 15;
    });
  }

  // ---- Cancelled marker (neutral grey, behind nothing important)
  if (inv.status === 'Cancelled') {
    doc.save();
    doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.font('Bold').fontSize(80).fillColor('#9ca3af').fillOpacity(0.25)
      .text('CANCELLED', 0, doc.page.height / 2 - 40, { width: doc.page.width, align: 'center' });
    doc.restore();
    doc.fillOpacity(1);
    if (inv.cancelReason) {
      doc.font('Regular').fontSize(9).fillColor(INK_SOFT)
        .text(`Cancelled on ${fmtDate(inv.cancelledAt)}: ${inv.cancelReason}`, L, Math.min(y + 14, bottomLimit()), { width: W });
    }
  }

  // ---- Footer on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would otherwise start a new page
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - bottomMargin + 10;
    doc.moveTo(L, fy - 6).lineTo(R, fy - 6).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.font('Regular').fontSize(8).fillColor(INK_SOFT).text(
      `This is a computer-generated invoice.  ·  ${h.name || ''}${h.phone ? `  ·  ${h.phone}` : ''}  ·  Page ${i - range.start + 1} of ${range.count}`,
      L, fy, { width: W, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = bottomMargin;
  }

  doc.end();
}
