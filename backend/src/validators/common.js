import { z } from 'zod';
import mongoose from 'mongoose';
import { parseDate } from '../utils/date.js';
import { normalizePhone } from '../utils/phone.js';

export const objectId = z
  .string({ required_error: 'Required' })
  .trim()
  .refine((v) => mongoose.isValidObjectId(v) && /^[0-9a-fA-F]{24}$/.test(v), 'Invalid id');

export const idParams = z.object({ id: objectId });

/** ISO date string (or YYYY-MM-DD, read in the hotel timezone) → Date. */
export const isoDate = z
  .union([z.string().trim().min(1), z.date()])
  .transform((v, ctx) => {
    const d = parseDate(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date, use an ISO string' });
      return z.NEVER;
    }
    return d;
  });

/** Optional text that may arrive as null/undefined. */
export const optText = (max = 2000) => z.string().trim().max(max).optional().nullable().transform((v) => v ?? undefined);

export const phone = z
  .string({ required_error: 'Phone is required' })
  .trim()
  .max(20)
  .transform(normalizePhone)
  .refine((v) => /^\+?\d{7,15}$/.test(v), 'Enter a valid phone number (7–15 digits)');

export const optEmail = z
  .union([z.string().trim().toLowerCase().email('Invalid email'), z.literal(''), z.null()])
  .optional()
  .transform((v) => v ?? undefined);

/**
 * Numbers from JSON, form fields or query strings. "" and null mean "not sent"
 * (never 0), numeric strings are converted, and NaN / Infinity are rejected.
 */
const toNumber = (v) => {
  if (v === '' || v === null) return undefined;
  if (typeof v === 'string') {
    const n = Number(v.trim());
    return v.trim() === '' || Number.isNaN(n) ? v : n;
  }
  return v;
};
const baseNumber = () =>
  z.number({ required_error: 'Required', invalid_type_error: 'Must be a number' }).finite('Must be a finite number');

/** Required number: num((n) => n.int().min(1)) */
export const num = (refine = (n) => n) => z.preprocess(toNumber, refine(baseNumber()));
/** Optional number; "" / null are treated as absent. */
export const optNum = (refine = (n) => n) => z.preprocess(toNumber, refine(baseNumber()).optional());

export const money = num((n) => n.min(0, 'Must be zero or more'));
export const optMoney = optNum((n) => n.min(0, 'Must be zero or more'));
export const percent = optNum((n) => n.min(0).max(100, 'Must be 0–100'));

/** Text-or-number field (room numbers, floors) without turning undefined/null into "undefined"/"null". */
export const textOrNumber = (max) =>
  z.union([z.string(), z.number()]).transform((v) => String(v).trim()).pipe(z.string().max(max));

export const pagination = {
  page: num((n) => n.int().min(1)).default(1),
  // Larger limits are capped at 100 rather than rejected
  limit: num((n) => n.int().min(1)).default(20).transform((v) => Math.min(v, 100)),
};

/** Query-string boolean ("true"/"false"/"1"/"0"). */
export const qsBool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

/** Form fields arrive as strings in multipart requests. */
export const formBool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'on'])])
  .transform((v) => v === true || v === 'true' || v === '1' || v === 'on');
