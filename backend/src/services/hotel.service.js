import { Hotel, ExpenseCategory, DEFAULT_EXPENSE_CATEGORIES } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

/** Load a hotel or throw 404. Every hotel-scoped route goes through this. */
export async function ensureHotel(hotelId, { session } = {}) {
  const hotel = await Hotel.findById(hotelId).session(session || null);
  if (!hotel) throw ApiError.notFound('Hotel not found');
  return hotel;
}

export async function createDefaultCategories(hotelId) {
  await ExpenseCategory.insertMany(
    DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ hotelId, name })),
    { ordered: false }
  ).catch((err) => {
    // Ignore duplicates if some categories already exist
    if (err.code !== 11000 && !err.writeErrors) throw err;
  });
}
