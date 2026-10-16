import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

export const ENQUIRY_STATUSES = ['New', 'Contacted', 'Converted', 'Closed'];

const enquirySchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    roomType: { type: String, default: '' },
    guests: { type: Number, min: 1, default: 1 },
    message: { type: String, default: '' },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'New', index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  },
  schemaOptions()
);

export const Enquiry = mongoose.model('Enquiry', enquirySchema);
