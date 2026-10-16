import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/expense.controller.js';
import { EXPENSE_PAYMENT_MODES } from '../models/index.js';
import { uploadAny } from '../middlewares/upload.js';
import { parseMultipartData, validate } from '../middlewares/validate.js';
import { idParams, isoDate, num, objectId, optNum, optText, pagination } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

export const expenseRouter = Router();
export const categoryRouter = Router();

const expenseFields = {
  date: isoDate,
  categoryId: objectId.optional(),
  // Alternative to categoryId: the category name
  category: z.string().trim().min(1).max(60).optional(),
  amount: num((n) => n.positive('Amount must be more than 0').max(10_000_000, 'Amount is too large')),
  paidTo: optText(120),
  paymentMode: z.enum(EXPENSE_PAYMENT_MODES).optional(),
  note: optText(1000),
};

const createBody = z
  .object({ hotelId: objectId, ...expenseFields })
  .refine((d) => d.categoryId || d.category, { message: 'categoryId is required', path: ['categoryId'] });
const updateBody = z
  .object({ ...expenseFields, amount: optNum((n) => n.positive('Amount must be more than 0').max(10_000_000, 'Amount is too large')) })
  .partial();

const listQuery = z.object({
  ...pagination,
  hotelId: objectId,
  from: isoDate.optional(),
  to: isoDate.optional(),
  category: z.string().trim().max(60).optional(),
  categoryId: objectId.optional(),
});

const bill = uploadAny.fields([
  { name: 'bill', maxCount: 1 },
  { name: 'files', maxCount: 5 },
]);

expenseRouter.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
expenseRouter.post('/', bill, parseMultipartData, validate({ body: createBody }), asyncHandler(ctrl.create));
expenseRouter.put('/:id', validate({ params: idParams }), bill, parseMultipartData, validate({ body: updateBody }), asyncHandler(ctrl.update));
expenseRouter.delete('/:id', validate({ params: idParams }), asyncHandler(ctrl.remove));

// hotelId may be in the query (?hotelId=) or the body for POST
const categoryListQuery = z.object({ ...pagination, hotelId: objectId });
const categoryBody = z.object({ hotelId: objectId, name: z.string().trim().min(1, 'Name is required').max(60) });
const hotelIdFromQuery = (req, _res, next) => {
  if (!req.body?.hotelId && req.query?.hotelId) req.body = { ...req.body, hotelId: req.query.hotelId };
  next();
};

categoryRouter.get('/', validate({ query: categoryListQuery }), asyncHandler(ctrl.listCategories));
categoryRouter.post('/', hotelIdFromQuery, validate({ body: categoryBody }), asyncHandler(ctrl.createCategory));
categoryRouter.delete('/:id', validate({ params: idParams }), asyncHandler(ctrl.removeCategory));
