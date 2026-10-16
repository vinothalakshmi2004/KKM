import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank'];

const paymentSchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    amount: { type: Number, min: 0.01, required: true },
    date: { type: Date, required: true, default: Date.now },
    mode: { type: String, enum: PAYMENT_MODES, required: true },
    note: { type: String, default: '' },
    // Set when the booking is deleted (monthly cleanup), so income still shows which booking
    // and which guest it was after the booking and guest records are gone
    bookingNo: { type: String, default: '' },
    guestName: { type: String, default: '' },
    guestPhone: { type: String, default: '' },
  },
  schemaOptions()
);

paymentSchema.index({ hotelId: 1, date: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);
