import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/onlineBooking.controller.js';
import { validate } from '../middlewares/validate.js';
import { ONLINE_TABS } from '../services/onlineBooking.service.js';
import { idParams, isoDate, objectId, pagination, qsBool } from '../validators/common.js';
import { endOfDay, startOfDay } from '../utils/date.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const blank = z.literal('').transform(() => undefined);
const hotelQuery = z.object({ hotelId: objectId });
const listQuery = z.object({
  ...pagination,
  hotelId: objectId,
  status: z.enum(ONLINE_TABS).optional().or(blank),
  unseen: qsBool.optional(),
  from: isoDate.transform(startOfDay).optional(),
  to: isoDate.transform(endOfDay).optional(),
  search: z.string().trim().max(100).optional(),
});

// Static paths before "/:id"
router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.get('/unseen-count', validate({ query: hotelQuery }), asyncHandler(ctrl.count));
router.post('/seen-all', validate({ query: hotelQuery }), asyncHandler(ctrl.markAllSeen));
router.post('/:id/seen', validate({ params: idParams }), asyncHandler(ctrl.markSeen));
router.post('/:id/reveal-aadhaar', validate({ params: idParams }), asyncHandler(ctrl.revealAadhaar));

export default router;
