import mongoose from 'mongoose';
import { schemaOptions, hotelRef } from './_shared.js';

// Common hotel roles; any other role can be typed in
export const EMPLOYEE_ROLES = ['Manager', 'Receptionist', 'Housekeeping', 'Room Boy', 'Cook', 'Security', 'Cleaner', 'Driver', 'Accountant', 'Maintenance'];
export const EMPLOYEE_STATUSES = ['Active', 'Inactive'];
export const SALARY_TYPES = ['Monthly', 'Daily'];

const employeeSchema = new mongoose.Schema(
  {
    hotelId: hotelRef,
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    role: { type: String, required: true, trim: true },
    salary: { type: Number, min: 0, default: 0 },
    salaryType: { type: String, enum: SALARY_TYPES, default: 'Monthly' },
    joinDate: { type: Date, default: null },
    status: { type: String, enum: EMPLOYEE_STATUSES, default: 'Active' },
    address: { type: String, default: '' },
    idProofType: { type: String, default: '' },
    idProofNumber: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    bankDetails: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  schemaOptions()
);

employeeSchema.index({ hotelId: 1, status: 1, name: 1 });

export const Employee = mongoose.model('Employee', employeeSchema);
