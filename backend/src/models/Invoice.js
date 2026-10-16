import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

export const INVOICE_STATUSES = ['Issued', 'Cancelled'];

const lineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    qty: { type: Number, required: true }, // nights for rooms, 1 for extra charges
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  { date: Date, mode: String, amount: Number, note: String },
  { _id: false }
);

/**
 * A tax invoice for one booking. Everything printed on it is copied ("snapshotted") when it
 * is issued, so later edits to the booking, guest or hotel never change an issued invoice.
 * To correct one: cancel it and issue a new one.
 */
const invoiceSchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    invoiceNo: { type: String, required: true },
    financialYear: { type: String, required: true }, // e.g. "2026-27"
    issuedAt: { type: Date, required: true },
    status: { type: String, enum: INVOICE_STATUSES, default: 'Issued', index: true },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },

    hotel: {
      name: String, address: String, area: String, city: String, phone: String, email: String, gstin: String,
    },
    guest: {
      name: String, phone: String, email: String, address: String, idProofType: String, idProofNumber: String,
    },
    stay: {
      bookingNo: String, checkIn: Date, checkOut: Date, nights: Number, adults: Number, children: Number,
    },

    lines: { type: [lineSchema], default: [] },
    subtotal: { type: Number, required: true }, // rooms + extra charges
    discount: { type: Number, default: 0 },
    taxableValue: { type: Number, required: true },
    gstPercent: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    payments: { type: [paymentSchema], default: [] },

    // Booking's updatedAt when issued: lets the UI warn if the booking changed afterwards
    bookingUpdatedAt: { type: Date, default: null },
  },
  schemaOptions()
);

invoiceSchema.index({ hotelId: 1, invoiceNo: 1 }, { unique: true });
invoiceSchema.index({ hotelId: 1, issuedAt: -1 });
// At most one issued (non-cancelled) invoice per booking
invoiceSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { status: 'Issued' }, name: 'one_issued_per_booking' });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
