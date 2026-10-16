import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

export const OWNER_TYPES = ['booking', 'guest', 'expense'];

const documentSchema = new mongoose.Schema(
  {
    ownerType: { type: String, enum: OWNER_TYPES, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    hotelId: hotelRef,
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  schemaOptions()
);

documentSchema.index({ ownerType: 1, ownerId: 1 });

export const Document = mongoose.model('Document', documentSchema);
