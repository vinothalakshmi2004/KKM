import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/enquiry.controller.js';
import { ENQUIRY_STATUSES } from '../models/index.js';
import { validate } from '../middlewares/validate.js';
import { idParams, objectId, pagination } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const listQuery = z.object({
  ...pagination,
  hotelId: objectId,
  status: z.enum(ENQUIRY_STATUSES).optional().or(z.literal('').transform(() => undefined)),
});

const updateBody = z
  .object({
    status: z.enum(ENQUIRY_STATUSES).optional(),
    bookingId: objectId.nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' });

router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.put('/:id', validate({ params: idParams, body: updateBody }), asyncHandler(ctrl.update));

export default router;
