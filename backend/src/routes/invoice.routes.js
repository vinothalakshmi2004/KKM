import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/invoice.controller.js';
import { INVOICE_STATUSES } from '../models/index.js';
import { validate } from '../middlewares/validate.js';
import { idParams, isoDate, objectId, optText, pagination, qsBool } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const listQuery = z.object({
  ...pagination,
  hotelId: objectId,
  status: z.enum(INVOICE_STATUSES).optional().or(z.literal('').transform(() => undefined)),
  bookingId: objectId.optional(),
  search: z.string().trim().max(100).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.post('/', validate({ body: z.object({ bookingId: objectId }) }), asyncHandler(ctrl.create));
router.get('/:id', validate({ params: idParams }), asyncHandler(ctrl.get));
router.get('/:id/pdf', validate({ params: idParams, query: z.object({ download: qsBool.optional() }) }), asyncHandler(ctrl.pdf));
router.post('/:id/cancel', validate({ params: idParams, body: z.object({ reason: optText(500) }) }), asyncHandler(ctrl.cancel));

export default router;
