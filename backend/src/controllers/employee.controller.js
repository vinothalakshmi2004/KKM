import mongoose from 'mongoose';
import { Employee } from '../models/index.js';
import { ensureHotel } from '../services/hotel.service.js';
import { emitToHotel } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, getPaging, ok, created, paged, round2 } from '../utils/http.js';

export async function list(req, res) {
  const { hotelId, search, role, status } = req.query;
  await ensureHotel(hotelId);
  const paging = getPaging(req.query);
  const filter = { hotelId };
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const digits = search.replace(/\D/g, '');
    filter.$or = [{ name: rx }, { role: rx }, { email: rx }, ...(digits.length >= 3 ? [{ phone: new RegExp(digits) }] : [])];
  }
  const [items, total, summary, roles] = await Promise.all([
    Employee.find(filter).sort({ status: 1, name: 1 }).skip(paging.skip).limit(paging.limit),
    Employee.countDocuments(filter),
    // Salary bill of active staff (daily wages counted for 30 days)
    Employee.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(String(hotelId)), status: 'Active' } },
      {
        $group: {
          _id: null,
          active: { $sum: 1 },
          monthly: { $sum: { $cond: [{ $eq: ['$salaryType', 'Daily'] }, { $multiply: ['$salary', 30] }, '$salary'] } },
        },
      },
    ]),
    Employee.distinct('role', { hotelId }),
  ]);
  ok(res, {
    ...paged(items, total, paging),
    summary: {
      active: summary[0]?.active || 0,
      total: await Employee.countDocuments({ hotelId }),
      monthlySalary: round2(summary[0]?.monthly || 0),
    },
    roles: roles.sort(),
  });
}

export async function get(req, res) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');
  ok(res, employee);
}

export async function create(req, res) {
  await ensureHotel(req.body.hotelId);
  const employee = await Employee.create(req.body);
  emitToHotel(employee.hotelId, 'employee:updated', { employeeId: employee._id });
  created(res, employee, `${employee.name} added`);
}

export async function update(req, res) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');
  Object.assign(employee, req.body);
  await employee.save();
  emitToHotel(employee.hotelId, 'employee:updated', { employeeId: employee._id });
  ok(res, employee, 'Employee updated');
}

export async function remove(req, res) {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');
  emitToHotel(employee.hotelId, 'employee:updated', { employeeId: employee._id, action: 'deleted' });
  ok(res, null, `${employee.name} removed`);
}
