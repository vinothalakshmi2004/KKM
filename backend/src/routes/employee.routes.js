import { Router } from 'express';
import { z } from 'zod';
import * as ctrl from '../controllers/employee.controller.js';
import { EMPLOYEE_STATUSES, SALARY_TYPES } from '../models/index.js';
import { validate } from '../middlewares/validate.js';
import { idParams, isoDate, objectId, optEmail, optMoney, optText, pagination, phone } from '../validators/common.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
const blank = z.literal('').transform(() => undefined);

const fields = {
  name: z.string().trim().min(2, 'Name is required').max(120),
  phone,
  email: optEmail,
  role: z.string().trim().min(2, 'Role is required').max(60),
  salary: optMoney,
  salaryType: z.enum(SALARY_TYPES).optional(),
  joinDate: z.union([isoDate, z.null(), blank]).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  address: optText(500),
  idProofType: optText(40),
  idProofNumber: optText(60),
  emergencyContact: optText(120),
  bankDetails: optText(300),
  notes: optText(2000),
};

const listQuery = z.object({
  ...pagination,
  hotelId: objectId,
  search: z.string().trim().max(100).optional(),
  role: z.string().trim().max(60).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional().or(blank),
});

router.get('/', validate({ query: listQuery }), asyncHandler(ctrl.list));
router.post('/', validate({ body: z.object({ hotelId: objectId, ...fields }) }), asyncHandler(ctrl.create));
router.get('/:id', validate({ params: idParams }), asyncHandler(ctrl.get));
router.put('/:id', validate({ params: idParams, body: z.object(fields).partial() }), asyncHandler(ctrl.update));
router.delete('/:id', validate({ params: idParams }), asyncHandler(ctrl.remove));

export default router;
