import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

const guestSchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, default: '' },
    idProofType: { type: String, default: '' },
    idProofNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    // Aadhaar from online bookings: last 4 digits for display, full number AES-256-GCM encrypted.
    // The encrypted value and the reveal log are never selected unless asked for.
    aadhaarLast4: { type: String, default: '' },
    aadhaarEncrypted: { type: String, default: '', select: false },
    aadhaarRevealLog: {
      type: [
        new mongoose.Schema(
          {
            adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
            adminEmail: { type: String, default: '' },
            bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
            at: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
      select: false,
    },
  },
  schemaOptions()
);

guestSchema.index({ hotelId: 1, phone: 1 });

export const Guest = mongoose.model('Guest', guestSchema);
