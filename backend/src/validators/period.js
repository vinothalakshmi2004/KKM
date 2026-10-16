import { z } from 'zod';
import { objectId, qsBool } from './common.js';

const day = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** Export / delete period: ?month=YYYY-MM, or ?from=YYYY-MM-DD&to=YYYY-MM-DD, or ?all=true. */
export const periodQuery = z
  .object({
    hotelId: objectId,
    month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM').optional(),
    from: day.optional(),
    to: day.optional(),
    all: qsBool.optional(),
  })
  .refine((q) => [q.month, q.from || q.to, q.all].filter(Boolean).length === 1, {
    message: 'Choose one period: month, from + to, or all',
    path: ['month'],
  })
  .refine((q) => !(q.from || q.to) || (q.from && q.to), { message: 'Both from and to are needed', path: ['to'] });
