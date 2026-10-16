import mongoose from 'mongoose';
import { Document, Expense, ExpenseCategory } from '../models/index.js';
import { collectFiles } from '../middlewares/upload.js';
import {
  createDocuments, deleteDocumentsFor, discardUploads, stageUploads,
} from '../services/document.service.js';
import { ensureHotel } from '../services/hotel.service.js';
import { emitToHotel } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { endOfDay, startOfDay } from '../utils/date.js';
import { escapeRegex, getPaging, ok, created, paged, round2 } from '../utils/http.js';

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

/** Resolve a category by id or by name, within the hotel. */
async function resolveCategory(hotelId, { categoryId, category }) {
  const found = categoryId
    ? await ExpenseCategory.findOne({ _id: categoryId, hotelId })
    : await ExpenseCategory.findOne({ hotelId, name: category }).collation(CASE_INSENSITIVE);
  if (!found) throw ApiError.badRequest('Expense category not found for this hotel');
  return found;
}

async function attachBills(expenses) {
  const docs = await Document.find({ ownerType: 'expense', ownerId: { $in: expenses.map((e) => e._id) } }).sort({ uploadedAt: 1 });
  const byOwner = new Map();
  for (const d of docs) {
    const key = String(d.ownerId);
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push(d);
  }
  return expenses.map((e) => ({ ...e.toJSON(), bills: byOwner.get(String(e._id)) || [] }));
}

/**
 * Upload the request's bill files, run `save`, then attach the bills.
 * Files go first, so a failed upload never leaves a half-applied change;
 * if saving fails the uploaded files are removed again.
 */
async function withBills(req, hotelId, save) {
  const staged = await stageUploads(collectFiles(req), { hotelId, ownerType: 'expense' });
  try {
    const expense = await save();
    await createDocuments(staged, { ownerType: 'expense', ownerId: expense._id, hotelId });
    return expense;
  } catch (err) {
    await discardUploads(staged);
    throw err;
  }
}

export async function list(req, res) {
  const { hotelId, from, to, category, categoryId } = req.query;
  await ensureHotel(hotelId);
  const paging = getPaging(req.query);

  const filter = { hotelId: new mongoose.Types.ObjectId(hotelId) };
  if (from || to) filter.date = {};
  if (from) filter.date.$gte = startOfDay(from);
  if (to) filter.date.$lte = endOfDay(to);
  if (categoryId) filter.categoryId = new mongoose.Types.ObjectId(categoryId);
  else if (category) {
    // "category" may be an id or a name
    filter.$or = mongoose.isValidObjectId(category) && /^[0-9a-f]{24}$/i.test(category)
      ? [{ categoryId: new mongoose.Types.ObjectId(category) }]
      : [{ categoryName: new RegExp(`^${escapeRegex(category)}$`, 'i') }];
  }

  const [expenses, total, [sum]] = await Promise.all([
    Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip(paging.skip).limit(paging.limit),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: filter }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
  ]);

  ok(res, { ...paged(await attachBills(expenses), total, paging), totalAmount: round2(sum?.amount) });
}

export async function create(req, res) {
  const { hotelId, categoryId, category, ...fields } = req.body;
  await ensureHotel(hotelId);
  const cat = await resolveCategory(hotelId, { categoryId, category });

  const expense = await withBills(req, hotelId, () =>
    Expense.create({ ...fields, hotelId, categoryId: cat._id, categoryName: cat.name })
  );

  emitToHotel(hotelId, 'expense:created', { expense });
  const [result] = await attachBills([expense]);
  created(res, result, 'Expense added');
}

export async function update(req, res) {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound('Expense not found');

  const { categoryId, category, ...fields } = req.body;
  if (categoryId || category) {
    const cat = await resolveCategory(expense.hotelId, { categoryId, category });
    expense.categoryId = cat._id;
    expense.categoryName = cat.name;
  }
  Object.assign(expense, fields);
  await withBills(req, expense.hotelId, () => expense.save());

  emitToHotel(expense.hotelId, 'expense:updated', { expense });
  const [result] = await attachBills([expense]);
  ok(res, result, 'Expense updated');
}

export async function remove(req, res) {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound('Expense not found');
  await deleteDocumentsFor('expense', [expense._id]);
  await expense.deleteOne();
  emitToHotel(expense.hotelId, 'expense:updated', { action: 'deleted', expenseId: expense._id });
  ok(res, null, 'Expense deleted');
}

// ---------------------------------------------------------------- categories

export async function listCategories(req, res) {
  const { hotelId } = req.query;
  await ensureHotel(hotelId);
  const paging = getPaging(req.query);
  const [items, total] = await Promise.all([
    ExpenseCategory.find({ hotelId }).collation(CASE_INSENSITIVE).sort({ name: 1 }).skip(paging.skip).limit(paging.limit),
    ExpenseCategory.countDocuments({ hotelId }),
  ]);
  ok(res, paged(items, total, paging));
}

export async function createCategory(req, res) {
  const { hotelId, name } = req.body;
  await ensureHotel(hotelId);
  const exists = await ExpenseCategory.findOne({ hotelId, name }).collation(CASE_INSENSITIVE);
  if (exists) throw ApiError.conflict(`Category "${exists.name}" already exists`);
  created(res, await ExpenseCategory.create({ hotelId, name }), 'Category added');
}

export async function removeCategory(req, res) {
  const category = await ExpenseCategory.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  const used = await Expense.countDocuments({ categoryId: category._id });
  if (used) throw ApiError.conflict(`"${category.name}" is used by ${used} expense(s) and cannot be deleted`);
  await category.deleteOne();
  ok(res, null, 'Category deleted');
}
