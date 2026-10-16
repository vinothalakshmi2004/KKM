import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

// Every room can be let as AC or Non-AC; the mode is chosen per booking
export const ROOM_TYPES = ['AC', 'Non-AC'];
export const ROOM_STATUSES = ['Available', 'Maintenance'];

const roomSchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    roomNumber: { type: String, required: true, trim: true },
    floor: { type: String, trim: true, default: '' },
    bedType: { type: String, trim: true, default: '' },
    maxGuests: { type: Number, min: 1, default: 2 },
    acPrice: { type: Number, min: 0, required: true },
    nonAcPrice: { type: Number, min: 0, required: true },
    amenities: { type: [String], default: [] },
    status: { type: String, enum: ROOM_STATUSES, default: 'Available' },
    notes: { type: String, default: '' },
    // Bumped inside booking transactions so concurrent bookings of the same room conflict
    bookingLock: { type: Number, default: 0, select: false },
  },
  schemaOptions()
);

roomSchema.index({ hotelId: 1, roomNumber: 1 }, { unique: true });

/** Nightly price for a booking mode ("AC" / "Non-AC"). */
roomSchema.methods.priceFor = function priceFor(type) {
  return type === 'Non-AC' ? this.nonAcPrice : this.acPrice;
};

export const Room = mongoose.model('Room', roomSchema);
