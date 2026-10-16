import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/report.controller.js';
import { validate } from '../middlewares/validate.js';
import { isoDate, objectId, optNum } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

export const reportRouter = Router();
export const dashboardRouter = Router();

const summaryQuery = z.object({ hotelId: objectId, from: isoDate.optional(), to: isoDate.optional() });
const yearlyQuery = z.object({ hotelId: objectId, year: optNum((n) => n.int().min(2000).max(2100)) });
const hotelQuery = z.object({ hotelId: objectId });

reportRouter.get('/summary', validate({ query: summaryQuery }), asyncHandler(ctrl.summary));
reportRouter.get('/yearly', validate({ query: yearlyQuery }), asyncHandler(ctrl.yearly));
dashboardRouter.get('/', validate({ query: hotelQuery }), asyncHandler(ctrl.dashboard));
