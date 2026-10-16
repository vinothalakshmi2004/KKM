import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Pantry items', 'Maintenance', 'Cleaning', 'Staff salary', 'Electricity', 'Cable TV', 'Water', 'Other',
];

const categorySchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    name: { type: String, required: true, trim: true },
  },
  schemaOptions()
);

// Case-insensitive uniqueness per hotel ("Water" and "water" clash)
categorySchema.index({ hotelId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const ExpenseCategory = mongoose.model('ExpenseCategory', categorySchema);
