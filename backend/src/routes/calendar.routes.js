import { Router } from 'express';
import { z } from 'zod';
import { ROOM_TYPES } from '../models/index.js';
import { validate } from '../middlewares/validate.js';
import { ensureHotel } from '../services/hotel.service.js';
import { getCalendar, MAX_CALENDAR_DAYS } from '../services/calendar.service.js';
import { asyncHandler, ok } from '../utils/http.js';
import { dayjs, TZ, startOfDay } from '../utils/date.js';
import { isoDate, objectId, qsBool } from '../validators/common.js';

const router = Router();

const calendarQuery = z
  .object({
    hotelId: objectId,
    from: isoDate,
    to: isoDate,
    type: z.enum(ROOM_TYPES).optional().or(z.literal('').transform(() => undefined)),
    includeCancelled: qsBool.optional(),
  })
  .superRefine((q, ctx) => {
    const days = dayjs(startOfDay(q.to)).tz(TZ).diff(dayjs(startOfDay(q.from)).tz(TZ), 'day') + 1;
    if (days < 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: '"to" must be on or after "from"' });
    if (days > MAX_CALENDAR_DAYS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: `Range can be at most ${MAX_CALENDAR_DAYS} days` });
    }
  });

// GET /api/calendar?hotelId=&from=YYYY-MM-DD&to=YYYY-MM-DD&type=&includeCancelled=
router.get(
  '/',
  validate({ query: calendarQuery }),
  asyncHandler(async (req, res) => {
    await ensureHotel(req.query.hotelId);
    ok(res, await getCalendar(req.query));
  })
);

export default router;
