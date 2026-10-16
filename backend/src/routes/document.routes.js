import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/document.controller.js';
import { OWNER_TYPES } from '../models/index.js';
import { uploadAny } from '../middlewares/upload.js';
import { parseMultipartData, validate } from '../middlewares/validate.js';
import { idParams, objectId, qsBool } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const ownerFields = { ownerType: z.enum(OWNER_TYPES), ownerId: objectId };

const files = uploadAny.fields([
  { name: 'files', maxCount: 10 },
  { name: 'file', maxCount: 10 },
]);

router.post('/', files, parseMultipartData, validate({ body: z.object(ownerFields) }), asyncHandler(ctrl.upload));
router.get('/', validate({ query: z.object(ownerFields) }), asyncHandler(ctrl.list));
router.get('/:id/file', validate({ params: idParams, query: z.object({ download: qsBool.optional() }) }), asyncHandler(ctrl.file));
router.delete('/:id', validate({ params: idParams }), asyncHandler(ctrl.remove));

export default router;
