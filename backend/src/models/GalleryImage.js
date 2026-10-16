import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

const galleryImageSchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
    caption: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  schemaOptions()
);

galleryImageSchema.virtual('imageUrl').get(function imageUrl() {
  return `/api/gallery/${this._id}/image`;
});

export const GalleryImage = mongoose.model('GalleryImage', galleryImageSchema);
