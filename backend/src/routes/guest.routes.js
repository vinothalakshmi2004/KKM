import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/guest.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParams, objectId, pagination, isoDate } from '../validators/common.js';
import { guestFields } from '../validators/guest.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const listQuery = z.object({
  ...pagination,
  hotelId: objectId,
  search: z.string().trim().max(100).optional(),
});

const exportQuery = z.object({
  hotelId: objectId,
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(100).optional(),
});

const createBody = z.object({ hotelId: objectId, ...guestFields });
const updateBody = z.object(guestFields).partial();

// NOTE: /export must come before /:id so the literal isn't captured as a param
router.get('/export', validate({ query: exportQuery }), asyncHandler(ctrl.exportCsv));
router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.post('/', validate({ body: createBody }), asyncHandler(ctrl.create));
router.get('/:id', validate({ params: idParams }), asyncHandler(ctrl.get));
router.put('/:id', validate({ params: idParams, body: updateBody }), asyncHandler(ctrl.update));

export default router;

