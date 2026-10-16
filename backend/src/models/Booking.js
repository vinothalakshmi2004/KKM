import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

export const BOOKING_STATUSES = ['Booked', 'Checked-in', 'Checked-out', 'Cancelled'];
// Statuses that hold a room
export const ACTIVE_STATUSES = ['Booked', 'Checked-in'];
export const BOOKING_SOURCES = ['Walk-in', 'WhatsApp', 'Phone', 'Other', 'Online'];
export const ONLINE_PAYMENT_STATUSES = ['Pay at hotel', 'Paid'];

const bookingRoomSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    roomNumber: { type: String, required: true },
    type: { type: String, required: true },
    ratePerNight: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

const extraChargeSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    bookingNo: { type: String, required: true },
    guestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', required: true, index: true },
    rooms: { type: [bookingRoomSchema], validate: [(v) => v.length > 0, 'At least one room is required'] },
    adults: { type: Number, min: 1, default: 1 },
    children: { type: Number, min: 0, default: 0 },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, min: 1, required: true },
    roomTotal: { type: Number, default: 0 },
    extraCharges: { type: [extraChargeSchema], default: [] },
    discount: { type: Number, min: 0, default: 0 },
    gstPercent: { type: Number, min: 0, max: 100, default: 0 },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: BOOKING_STATUSES, default: 'Booked' },
    source: { type: String, enum: BOOKING_SOURCES, default: 'Walk-in' },
    enquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', default: null },
    notes: { type: String, default: '' },
    actualCheckIn: { type: Date, default: null },
    actualCheckOut: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    // ---- Online bookings (source "Online") only
    onlineRef: { type: String, default: undefined },
    // Admin-created bookings are seen already; online ones start unseen
    seenByAdmin: { type: Boolean, default: true },
    online: {
      type: new mongoose.Schema(
        {
          ip: { type: String, default: '' },
          userAgent: { type: String, default: '' },
          consentAt: { type: Date, default: null },
          paymentMode: { type: String, default: 'dummy' },
          paymentStatus: { type: String, enum: ONLINE_PAYMENT_STATUSES, default: 'Pay at hotel' },
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  schemaOptions()
);

bookingSchema.index({ hotelId: 1, checkIn: 1, checkOut: 1, status: 1 });
bookingSchema.index({ hotelId: 1, bookingNo: 1 }, { unique: true });
bookingSchema.index({ 'rooms.roomId': 1, status: 1 });
bookingSchema.index(
  { hotelId: 1, onlineRef: 1 },
  { unique: true, partialFilterExpression: { onlineRef: { $type: 'string' } } }
);
bookingSchema.index({ hotelId: 1, source: 1, seenByAdmin: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
