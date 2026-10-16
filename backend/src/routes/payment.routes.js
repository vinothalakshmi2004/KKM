import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/payment.controller.js';
import { PAYMENT_MODES } from '../models/index.js';
import { validate } from '../middlewares/validate.js';
import { idParams, isoDate, objectId, pagination } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const listQuery = z.object({
  ...pagination,
  hotelId: objectId,
  from: isoDate.optional(),
  to: isoDate.optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  bookingId: objectId.optional(),
});

router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.delete('/:id', validate({ params: idParams }), asyncHandler(ctrl.remove));

export default router;
