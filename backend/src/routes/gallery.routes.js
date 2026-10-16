import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/gallery.controller.js';
import { uploadImages } from '../middlewares/upload.js';
import { parseMultipartData, validate } from '../middlewares/validate.js';
import { idParams, objectId, optNum, optText, pagination } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const images = uploadImages.fields([
  { name: 'images', maxCount: 20 },
  { name: 'image', maxCount: 20 },
]);

const listQuery = z.object({ ...pagination, hotelId: objectId });
const uploadBody = z.object({ hotelId: objectId, caption: optText(200) });
const updateBody = z
  .object({ caption: optText(200), order: optNum((n) => n.int().min(0)) })
  .refine((d) => d.caption !== undefined || d.order !== undefined, { message: 'Send caption and/or order' });

router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.post('/', images, parseMultipartData, validate({ body: uploadBody }), asyncHandler(ctrl.upload));
router.put('/:id', validate({ params: idParams, body: updateBody }), asyncHandler(ctrl.update));
router.delete('/:id', validate({ params: idParams }), asyncHandler(ctrl.remove));

export default router;
