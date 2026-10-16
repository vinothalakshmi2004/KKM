import { z } from 'zod';
import { optEmail, optText, phone } from './common.js';

export const ID_PROOF_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Voter ID', 'Driving License', 'Other'];

export const guestFields = {
  name: z.string().trim().min(2, 'Guest name is required').max(120),
  phone,
  email: optEmail,
  address: optText(500),
  idProofType: z.union([z.enum(ID_PROOF_TYPES), z.literal('')]).optional(),
  idProofNumber: optText(50),
  notes: optText(2000),
};

/** Guest object embedded in a booking request. */
export const guestObject = z.object(guestFields);
