import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/storage.controller.js';
import { validate } from '../middlewares/validate.js';
import { objectId } from '../validators/common.js';
import { periodQuery } from '../validators/period.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
const hotelQuery = z.object({ hotelId: objectId });
const monthQuery = periodQuery;

// Usage, months overview and cleanup (month deletes use DELETE /bookings/by-month)
router.get('/', validate({ query: hotelQuery }), asyncHandler(ctrl.summary));
router.delete('/unused-guests', validate({ query: hotelQuery }), asyncHandler(ctrl.removeUnusedGuests));
router.get('/income', validate({ query: monthQuery }), asyncHandler(ctrl.incomeMonth));
router.delete('/income', validate({ query: monthQuery }), asyncHandler(ctrl.incomeDelete));
router.get('/expenses', validate({ query: monthQuery }), asyncHandler(ctrl.expensesMonth));
router.delete('/expenses', validate({ query: monthQuery }), asyncHandler(ctrl.expensesDelete));

export default router;
