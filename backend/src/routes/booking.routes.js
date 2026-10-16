import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/booking.controller.js';
import { BOOKING_SOURCES, BOOKING_STATUSES, PAYMENT_MODES, ROOM_TYPES } from '../models/index.js';
import { uploadAny } from '../middlewares/upload.js';
import { parseMultipartData, validate } from '../middlewares/validate.js';
import { idParams, isoDate, num, objectId, optMoney, optNum, optText, pagination, percent } from '../validators/common.js';
import { guestObject } from '../validators/guest.js';
import { periodQuery } from '../validators/period.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

// A room is an id (booked as AC), or { roomId, type: "AC" | "Non-AC", ratePerNight? }
const roomRef = z.union([
  objectId.transform((roomId) => ({ roomId })),
  z.object({
    roomId: objectId,
    type: z.enum(ROOM_TYPES, { errorMap: () => ({ message: 'Type must be AC or Non-AC' }) }).optional(),
    ratePerNight: optMoney,
  }),
]);

const extraCharge = z.object({
  label: z.string().trim().min(1, 'Label is required').max(80),
  amount: num((n) => n.min(0, 'Must be zero or more')),
});

const bookingFields = {
  guestId: objectId.optional(),
  guest: guestObject.optional(),
  rooms: z.array(roomRef).min(1, 'Select at least one room').max(50),
  checkIn: isoDate,
  checkOut: isoDate,
  adults: optNum((n) => n.int().min(1).max(100)),
  children: optNum((n) => n.int().min(0).max(100)),
  extraCharges: z.array(extraCharge).max(50).optional(),
  discount: optMoney,
  gstPercent: percent,
  source: z.enum(BOOKING_SOURCES).optional(),
  notes: optText(2000),
};

const paymentFields = {
  amount: num((n) => n.positive('Amount must be more than 0').max(10_000_000, 'Amount is too large')),
  mode: z.enum(PAYMENT_MODES, { errorMap: () => ({ message: `Mode must be one of ${PAYMENT_MODES.join(', ')}` }) }),
  note: optText(500),
};

const oneGuest = (d) => !(d.guestId && d.guest);
const oneGuestMsg = { message: 'Send either guestId or guest, not both', path: ['guest'] };

const createBody = z
  .object({
    hotelId: objectId,
    ...bookingFields,
    enquiryId: objectId.optional(),
    advancePayment: z.object(paymentFields).optional(),
  })
  .refine((d) => d.guestId || d.guest, { message: 'Provide guestId or a guest object', path: ['guestId'] })
  .refine(oneGuest, oneGuestMsg)
  .refine((d) => d.checkOut > d.checkIn, { message: 'Check-out must be after check-in', path: ['checkOut'] });

const updateBody = z
  .object(bookingFields)
  .partial()
  .refine(oneGuest, oneGuestMsg)
  .refine((d) => !(d.checkIn && d.checkOut) || d.checkOut > d.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  });

const listQuery = z.object({
  ...pagination,
  hotelId: objectId,
  status: z.enum(BOOKING_STATUSES).optional().or(z.literal('').transform(() => undefined)),
  type: z.enum(ROOM_TYPES).optional().or(z.literal('').transform(() => undefined)),
  guestId: objectId.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(100).optional(),
});

const hotelQuery = z.object({ hotelId: objectId });
// Export / delete period (month, date range or all)
const monthQuery = periodQuery;
const cancelBody = z.object({ reason: optText(500) });
const paymentBody = z.object({ ...paymentFields, date: isoDate.optional() });

const bookingFiles = uploadAny.fields([
  { name: 'files', maxCount: 10 },
  { name: 'documents', maxCount: 10 },
]);

// Static paths before "/:id"
router.get('/inhouse', validate({ query: hotelQuery }), asyncHandler(ctrl.inhouse));
router.get('/by-month', validate({ query: monthQuery }), asyncHandler(ctrl.monthList));
router.delete('/by-month', validate({ query: monthQuery }), asyncHandler(ctrl.monthDelete));
router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.post('/', bookingFiles, parseMultipartData, validate({ body: createBody }), asyncHandler(ctrl.create));
router.get('/:id', validate({ params: idParams }), asyncHandler(ctrl.get));
router.put('/:id', validate({ params: idParams }), bookingFiles, parseMultipartData, validate({ body: updateBody }), asyncHandler(ctrl.update));
router.post('/:id/checkin', validate({ params: idParams }), asyncHandler(ctrl.checkin));
router.post('/:id/checkout', validate({ params: idParams }), asyncHandler(ctrl.checkout));
router.post('/:id/cancel', validate({ params: idParams, body: cancelBody }), asyncHandler(ctrl.cancel));
router.post('/:id/payments', validate({ params: idParams, body: paymentBody }), asyncHandler(ctrl.createPayment));

export default router;
