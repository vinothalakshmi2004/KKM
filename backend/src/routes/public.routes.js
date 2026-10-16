import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as ctrl from '../controllers/public.controller.js';
import * as booking from '../controllers/publicBooking.controller.js';
import { uploadAny } from '../middlewares/upload.js';
import { isValidAadhaar } from '../utils/aadhaar.js';
import { ROOM_TYPES } from '../models/index.js';
import { parseMultipartData, validate } from '../middlewares/validate.js';
import { isoDate, num, optEmail, optNum, optText, pagination, phone } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many enquiries from this device. Please try again later or call the hotel.' },
});

const slugParams = z.object({ slug: z.string().trim().toLowerCase().min(1).max(120) });

const enquiryBody = z
  .object({
    hotelSlug: z.string().trim().toLowerCase().min(1, 'hotelSlug is required').max(120),
    name: z.string().trim().min(2, 'Name is required').max(80),
    phone,
    checkIn: isoDate.optional(),
    checkOut: isoDate.optional(),
    roomType: z
      .union([z.enum(ROOM_TYPES), z.literal(''), z.literal('Any')])
      .optional()
      .transform((v) => (v === 'Any' ? '' : v)),
    guests: optNum((n) => n.int().min(1, 'At least 1 guest').max(50)),
    message: optText(1000),
  })
  .refine((d) => !(d.checkIn && d.checkOut) || d.checkOut > d.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  });

// ---------------------------------------------------------------- online booking

const limiter = (windowMinutes, limit, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message },
  });

const lookupLimiter = limiter(5, 120, 'Too many searches from this device. Please wait a few minutes.');
const bookLimiter = limiter(60, 10, 'Too many booking attempts from this device. Please try again later or call the hotel.');
const statusLimiter = limiter(15, 30, 'Too many status checks from this device. Please try again later.');

const stayFields = {
  checkIn: isoDate,
  checkOut: isoDate,
  adults: num((n) => n.int().min(1, 'At least 1 adult').max(50)),
  children: optNum((n) => n.int().min(0).max(50)).transform((v) => v ?? 0),
};
const afterCheckIn = [(d) => d.checkOut > d.checkIn, { message: 'Check-out must be after check-in', path: ['checkOut'] }];

const roomSelection = z
  .array(
    z.object({
      type: z.enum(ROOM_TYPES, { errorMap: () => ({ message: 'Type must be AC or Non-AC' }) }),
      quantity: num((n) => n.int().min(0).max(20)),
    })
  )
  .max(2)
  .transform((rows) => rows.filter((r) => r.quantity > 0))
  .refine((rows) => rows.length > 0, 'Select at least one room')
  .refine((rows) => new Set(rows.map((r) => r.type)).size === rows.length, 'Each room type only once');

// Indian mobile: 10 digits (a +91 / 0 prefix is accepted), starting 6-9
const mobile = phone.refine((v) => /^\+91[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit mobile number');

const aadhaar = z
  .string({ required_error: 'Aadhaar number is required' })
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^\d{12}$/.test(v), 'Aadhaar number must be 12 digits')
  .refine(isValidAadhaar, 'Enter a valid Aadhaar number');

const availabilityQuery = z.object(stayFields).refine(...afterCheckIn);
const quoteBody = z.object({ ...stayFields, rooms: roomSelection }).refine(...afterCheckIn);
const bookBody = z
  .object({
    ...stayFields,
    rooms: roomSelection,
    guest: z.object({
      name: z.string().trim().min(2, 'Name is required').max(120),
      phone: mobile,
      email: optEmail,
      address: z.string().trim().min(5, 'Address is required').max(500),
    }),
    aadhaar,
    consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the consent to continue' }) }),
    website: z.string().max(200).optional(), // honeypot
  })
  .refine(...afterCheckIn);

const statusQuery = z.object({
  ref: z.string().trim().toUpperCase().regex(/^OB-\d{4}-\d{4,}$/, 'Enter the booking reference, e.g. OB-2026-0001'),
  phone: mobile,
});

const aadhaarFiles = uploadAny.fields([{ name: 'aadhaarFiles', maxCount: 2 }]);

router.get('/config', booking.config);
router.get('/hotels/:slug/availability', lookupLimiter, validate({ params: slugParams, query: availabilityQuery }), asyncHandler(booking.availability));
router.post('/hotels/:slug/quote', lookupLimiter, validate({ params: slugParams, body: quoteBody }), asyncHandler(booking.quote));
router.post(
  '/hotels/:slug/book',
  bookLimiter,
  validate({ params: slugParams }),
  aadhaarFiles,
  parseMultipartData,
  validate({ body: bookBody }),
  asyncHandler(booking.book)
);
router.get('/bookings/status', statusLimiter, validate({ query: statusQuery }), asyncHandler(booking.status));

// ---------------------------------------------------------------- hotels / enquiries

router.get('/hotels', validate({ query: z.object(pagination) }), asyncHandler(ctrl.listHotels));
router.get('/hotels/:slug', validate({ params: slugParams }), asyncHandler(ctrl.getHotel));
router.post('/enquiries', enquiryLimiter, validate({ body: enquiryBody }), asyncHandler(ctrl.createEnquiry));

export default router;
