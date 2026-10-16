import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/room.controller.js';
import { ROOM_STATUSES, ROOM_TYPES } from '../models/index.js';
import { validate } from '../middlewares/validate.js';
import { idParams, isoDate, money, num, objectId, optMoney, optNum, optText, pagination, textOrNumber } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

const amenities = z
  .array(z.string().trim().min(1).max(40))
  .max(50)
  .transform((list) => [...new Set(list)]);

const roomFields = {
  roomNumber: z
    .union([z.string(), z.number()], { required_error: 'Room number is required', invalid_type_error: 'Room number is required' })
    .transform((v) => String(v).trim())
    .pipe(z.string().min(1, 'Room number is required').max(20)),
  floor: z.union([textOrNumber(20), z.null()]).optional().transform((v) => v ?? undefined),
  bedType: optText(40),
  maxGuests: optNum((n) => n.int().min(1).max(20)),
  // Every room can be let as AC or Non-AC
  acPrice: money,
  nonAcPrice: money,
  amenities: amenities.optional(),
  status: z.enum(ROOM_STATUSES).optional(),
  notes: optText(1000),
};

const createBody = z.object({ hotelId: objectId, ...roomFields });
// Partial update: "" / null on a number means "leave unchanged", never 0
const updateBody = z.object({ ...roomFields, acPrice: optMoney, nonAcPrice: optMoney }).partial();

// Set AC / Non-AC prices for many rooms at once (all rooms of the hotel if roomIds is omitted)
const pricesBody = z
  .object({
    hotelId: objectId,
    roomIds: z.array(objectId).max(500).optional(),
    acPrice: optMoney,
    nonAcPrice: optMoney,
  })
  .refine((d) => d.acPrice !== undefined || d.nonAcPrice !== undefined, { message: 'Send acPrice and/or nonAcPrice' });

const bulkBody = z
  .object({
    hotelId: objectId,
    from: num((n) => n.int().min(0)),
    to: num((n) => n.int().min(0)),
    prefix: z.string().trim().max(10).optional(),
    acPrice: money,
    nonAcPrice: money,
    floor: roomFields.floor,
    bedType: roomFields.bedType,
    maxGuests: roomFields.maxGuests,
    amenities: roomFields.amenities,
    status: roomFields.status,
    notes: roomFields.notes,
  })
  .refine((d) => d.to >= d.from, { message: '"to" must be greater than or equal to "from"', path: ['to'] })
  .refine((d) => d.to - d.from < 500, { message: 'At most 500 rooms per bulk add', path: ['to'] });

const listQuery = z.object({
  ...pagination,
  hotelId: objectId,
  status: z.enum(ROOM_STATUSES).optional(),
  search: z.string().trim().max(20).optional(),
});

const availableQuery = z.object({
  hotelId: objectId,
  checkIn: isoDate,
  checkOut: isoDate,
  // Every room supports both modes, so this does not filter rooms; accepted for older clients
  type: z.enum(ROOM_TYPES).optional().or(z.literal('').transform(() => undefined)),
});

// Static paths before "/:id"
router.get('/available', validate({ query: availableQuery }), asyncHandler(ctrl.available));
router.post('/bulk', validate({ body: bulkBody }), asyncHandler(ctrl.bulkCreate));
router.put('/prices', validate({ body: pricesBody }), asyncHandler(ctrl.updatePrices));
router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.post('/', validate({ body: createBody }), asyncHandler(ctrl.create));
router.put('/:id', validate({ params: idParams, body: updateBody }), asyncHandler(ctrl.update));
router.delete('/:id', validate({ params: idParams }), asyncHandler(ctrl.remove));

export default router;
