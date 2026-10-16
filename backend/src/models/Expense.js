import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

export const EXPENSE_PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank'];

const expenseSchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    date: { type: Date, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true, index: true },
    categoryName: { type: String, required: true },
    amount: { type: Number, min: 0.01, required: true },
    paidTo: { type: String, default: '' },
    paymentMode: { type: String, enum: EXPENSE_PAYMENT_MODES, default: 'Cash' },
    note: { type: String, default: '' },
  },
  schemaOptions()
);

expenseSchema.index({ hotelId: 1, date: 1 });

export const Expense = mongoose.model('Expense', expenseSchema);
