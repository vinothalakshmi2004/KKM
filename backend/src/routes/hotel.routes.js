import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/hotel.controller.js';
import { uploadImages } from '../middlewares/upload.js';
import { parseMultipartData, validate } from '../middlewares/validate.js';
import { formBool, idParams, optEmail, optNum, optText, pagination, percent, qsBool } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';
import { normalizePhone } from '../utils/phone.js';

const router = Router();

const time = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24-hour)');
const optPhone = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((v) => (v ? normalizePhone(v) : v))
  .refine((v) => !v || /^\+?\d{7,15}$/.test(v), 'Enter a valid phone number (7–15 digits)');
// lat/lng: number or numeric string; "" / null clear the value
const coord = (min, max) =>
  z.union([z.literal(''), z.null(), optNum((n) => n.min(min).max(max))]).transform((v) => (v === '' || v === null ? null : v));

const hotelFields = {
  name: z.string().trim().min(2, 'Hotel name is required').max(120),
  slug: z.string().trim().max(120).optional(),
  address: optText(500),
  area: optText(120),
  city: optText(120),
  phone: optPhone,
  whatsappNumber: optPhone,
  email: optEmail,
  description: optText(5000),
  checkInTime: time.optional(),
  checkOutTime: time.optional(),
  mapEmbedUrl: optText(2000),
  lat: coord(-90, 90),
  lng: coord(-180, 180),
  gstPercent: percent,
  // 15-character GST number, e.g. 33ABCDE1234F1Z5 (optional)
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v), 'Enter a valid 15-character GSTIN')
    .optional(),
  isActive: formBool.optional(),
  onlineBookingEnabled: formBool.optional(),
  requireAadhaarUpload: formBool.optional(),
  onlineBookingNote: optText(1000),
};

const createBody = z.object(hotelFields);
const updateBody = z
  .object({ ...hotelFields, removeCover: formBool.optional() })
  .partial();

const listQuery = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  active: qsBool.optional(),
});

const cover = uploadImages.single('cover');

router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.post('/', cover, parseMultipartData, validate({ body: createBody }), asyncHandler(ctrl.create));
router.get('/:id', validate({ params: idParams }), asyncHandler(ctrl.get));
router.put('/:id', validate({ params: idParams }), cover, parseMultipartData, validate({ body: updateBody }), asyncHandler(ctrl.update));
router.delete('/:id', validate({ params: idParams }), asyncHandler(ctrl.remove));

export default router;
