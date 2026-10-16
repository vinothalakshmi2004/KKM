import mongoose from 'mongoose';
import { schemaOptions } from './_shared.js';

const hotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    address: { type: String, trim: true, default: '' },
    area: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    whatsappNumber: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    description: { type: String, default: '' },
    checkInTime: { type: String, default: '12:00' },
    checkOutTime: { type: String, default: '11:00' },
    mapEmbedUrl: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    coverImageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    gstPercent: { type: Number, min: 0, max: 100, default: 0 },
    // Shown on invoices; optional
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    isActive: { type: Boolean, default: true },
    // Public online booking (instant confirmation)
    onlineBookingEnabled: { type: Boolean, default: true },
    requireAadhaarUpload: { type: Boolean, default: true },
    onlineBookingNote: { type: String, trim: true, default: '' },
  },
  schemaOptions()
);

hotelSchema.virtual('coverUrl').get(function coverUrl() {
  return this.coverImageId ? `/api/hotels/${this._id}/cover` : null;
});

export const Hotel = mongoose.model('Hotel', hotelSchema);
