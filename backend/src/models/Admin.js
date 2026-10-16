import mongoose from 'mongoose';
import { schemaOptions } from './_shared.js';

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin'], default: 'admin' },
    // Tokens issued before this moment are rejected (set on password change)
    passwordChangedAt: { type: Date, default: null, select: false },
    // Admin portal personalisation: sidebar order (page paths) and hidden pages
    preferences: {
      sidebar: {
        order: { type: [String], default: [] },
        hidden: { type: [String], default: [] },
      },
    },
  },
  schemaOptions()
);

export const Admin = mongoose.model('Admin', adminSchema);
