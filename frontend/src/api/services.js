import api from './axios';
import { API_URL } from '../utils/apiUrl';

// Backend origin, for URLs it returns as "/api/..." (hotel covers, gallery images)
export const API_ORIGIN = (() => {
  try {
    return new URL(API_URL).origin;
  } catch {
    return '';
  }
})();

// Unwrap { success, data } responses
export const dataOf = (r) => r.data?.data ?? r.data;

// List endpoints return { items, total, page, pages }; a few return plain arrays
export const listOf = (r) => {
  const d = dataOf(r);
  return Array.isArray(d) ? d : d?.items || [];
};

// Backend caps page size at 100
export const MAX_LIMIT = 100;

/** Fetch every page of a list endpoint, e.g. for CSV export. */
export async function fetchAllPages(fn, params) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const d = dataOf(await fn({ ...params, page, limit: MAX_LIMIT }));
    all.push(...(d?.items || []));
    if (!d?.pages || page >= d.pages) return all;
  }
}

// Auth
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');
export const changePassword = (data) => api.put('/auth/password', data);
// { sidebar: { order: ['/admin', …], hidden: ['/admin/gallery', …] } }
export const updatePreferences = (data) => api.put('/auth/preferences', data);

// Hotels
export const getHotels = () => api.get('/hotels', { params: { limit: MAX_LIMIT } });
export const getHotel = (id) => api.get(`/hotels/${id}`);
export const createHotel = (data) => api.post('/hotels', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateHotel = (id, data) => api.put(`/hotels/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteHotel = (id) => api.delete(`/hotels/${id}`);

// Public
export const getPublicHotels = () => api.get('/public/hotels');
export const getPublicHotel = (slug) => api.get(`/public/hotels/${slug}`);
export const createPublicEnquiry = (data) => api.post('/public/enquiries', data);

// Public online booking (no login)
export const getPublicConfig = () => api.get('/public/config');
export const getPublicAvailability = (slug, params) => api.get(`/public/hotels/${slug}/availability`, { params });
export const getPublicQuote = (slug, data) => api.post(`/public/hotels/${slug}/quote`, data);
// Multipart: "data" (JSON) + "aadhaarFiles" (1-2 files)
export const createPublicBooking = (slug, formData) => api.post(`/public/hotels/${slug}/book`, formData, { timeout: 60000 });
export const getPublicBookingStatus = (params) => api.get('/public/bookings/status', { params });

// Online bookings (admin)
export const getOnlineBookings = (params) => api.get('/online-bookings', { params });
export const getOnlineUnseenCount = (hotelId) => api.get('/online-bookings/unseen-count', { params: { hotelId } });
export const markOnlineBookingSeen = (id) => api.post(`/online-bookings/${id}/seen`);
export const markAllOnlineBookingsSeen = (hotelId) => api.post('/online-bookings/seen-all', null, { params: { hotelId } });
export const revealBookingAadhaar = (id) => api.post(`/online-bookings/${id}/reveal-aadhaar`);

// Rooms
export const getRooms = (hotelId, params) => api.get('/rooms', { params: { hotelId, ...params } });
export const getAvailableRooms = (params) => api.get('/rooms/available', { params });
export const createRoom = (data) => api.post('/rooms', data);
export const bulkCreateRooms = (data) => api.post('/rooms/bulk', data);
// { hotelId, roomIds?, acPrice?, nonAcPrice? } — roomIds omitted = every room of the hotel
export const updateRoomPrices = (data) => api.put('/rooms/prices', data);
export const updateRoom = (id, data) => api.put(`/rooms/${id}`, data);
export const deleteRoom = (id) => api.delete(`/rooms/${id}`);

// Guests
export const getGuests = (params) => api.get('/guests', { params });
export const exportGuestsCsv = (params) => api.get('/guests/export', { params, responseType: 'blob' });
export const getGuest = (id) => api.get(`/guests/${id}`);
export const createGuest = (data) => api.post('/guests', data);
export const updateGuest = (id, data) => api.put(`/guests/${id}`, data);

// Bookings
export const getBookings = (params) => api.get('/bookings', { params });
export const getBooking = (id) => api.get(`/bookings/${id}`);
// Multipart: "data" (JSON) + optional "files"
export const createBooking = (formData) => api.post('/bookings', formData);
export const updateBooking = (id, data) => api.put(`/bookings/${id}`, data);
export const checkinBooking = (id) => api.post(`/bookings/${id}/checkin`);
export const checkoutBooking = (id) => api.post(`/bookings/${id}/checkout`);
export const cancelBooking = (id, data) => api.post(`/bookings/${id}/cancel`, data);
export const getInhouseBookings = (hotelId) => api.get('/bookings/inhouse', { params: { hotelId } });
// One month by check-in date (export), and bulk delete of a finished past month
export const getBookingsByMonth = (params) => api.get('/bookings/by-month', { params });
export const deleteBookingsByMonth = (params) => api.delete('/bookings/by-month', { params });

// Employees
export const getEmployees = (params) => api.get('/employees', { params });
export const createEmployee = (data) => api.post('/employees', data);
export const updateEmployee = (id, data) => api.put(`/employees/${id}`, data);
export const deleteEmployee = (id) => api.delete(`/employees/${id}`);

// Data & storage (Settings)
export const getStorageSummary = (hotelId) => api.get('/storage', { params: { hotelId } });
export const deleteUnusedGuests = (hotelId) => api.delete('/storage/unused-guests', { params: { hotelId } });
export const getIncomeByMonth = (params) => api.get('/storage/income', { params });
export const deleteIncomeByMonth = (params) => api.delete('/storage/income', { params });
export const getExpensesByMonth = (params) => api.get('/storage/expenses', { params });
export const deleteExpensesByMonth = (params) => api.delete('/storage/expenses', { params });

// Payments
export const getPayments = (params) => api.get('/payments', { params });
export const createPayment = (bookingId, data) => api.post(`/bookings/${bookingId}/payments`, data);
export const deletePayment = (id) => api.delete(`/payments/${id}`);

// Documents
export const getDocuments = (params) => api.get('/documents', { params });
export const uploadDocument = (data) => api.post('/documents', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getDocumentFile = (id) => api.get(`/documents/${id}/file`, { responseType: 'blob' });
export const deleteDocument = (id) => api.delete(`/documents/${id}`);

// Expenses
export const getExpenses = (params) => api.get('/expenses', { params });
export const createExpense = (data) => api.post('/expenses', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);

// Expense Categories
export const getExpenseCategories = (hotelId) => api.get('/expense-categories', { params: { hotelId, limit: MAX_LIMIT } });
export const createExpenseCategory = (data) => api.post('/expense-categories', data);
export const deleteExpenseCategory = (id) => api.delete(`/expense-categories/${id}`);

// Gallery
export const getGallery = (hotelId) => api.get('/gallery', { params: { hotelId, limit: MAX_LIMIT } });
export const uploadGalleryImage = (data) => api.post('/gallery', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateGalleryImage = (id, data) => api.put(`/gallery/${id}`, data);
export const deleteGalleryImage = (id) => api.delete(`/gallery/${id}`);
export const getGalleryImageUrl = (id) => `${API_URL}/gallery/${id}/image`;
export const getHotelCoverUrl = (hotel) => (hotel?.coverUrl ? `${API_ORIGIN}${hotel.coverUrl}` : null);

// Enquiries
export const getEnquiries = (params) => api.get('/enquiries', { params });
export const updateEnquiry = (id, data) => api.put(`/enquiries/${id}`, data);

// Reports
export const getDashboard = (hotelId) => api.get('/dashboard', { params: { hotelId } });
export const getReportSummary = (params) => api.get('/reports/summary', { params });
export const getYearlyReport = (params) => api.get('/reports/yearly', { params });

// Calendar: { hotelId, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', type?, includeCancelled? }
export const getCalendar = (params) => api.get('/calendar', { params });

// Invoices
export const getInvoices = (params) => api.get('/invoices', { params });
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const createInvoice = (bookingId) => api.post('/invoices', { bookingId });
export const cancelInvoice = (id, data) => api.post(`/invoices/${id}/cancel`, data);
export const getInvoicePdf = (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
