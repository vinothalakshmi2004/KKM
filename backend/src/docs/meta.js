/**
 * Human-written parts of the API docs. Paths, parameters and request bodies are generated from
 * the routes and their zod validation (see openapi.js); this file only adds titles, sections,
 * upload fields, file responses and a few ready-to-send examples.
 * Keys are "METHOD /api/path" exactly as Express defines them.
 */

export const TAGS = [
  { name: 'Auth', description: 'Admin login, profile, password and portal preferences' },
  { name: 'Public website', description: 'No login needed: hotels for the website, online booking, booking status, enquiries' },
  { name: 'Hotels', description: 'Hotels managed in the admin portal' },
  { name: 'Rooms', description: 'Rooms, AC / Non-AC prices, availability' },
  { name: 'Bookings', description: 'Bookings, check-in / check-out, cancellations, payments on a booking, month export' },
  { name: 'Online bookings', description: 'Bookings guests made on the website' },
  { name: 'Calendar', description: 'Room-by-day calendar data' },
  { name: 'Guests', description: 'Guest records and CSV export' },
  { name: 'Payments', description: 'Income (payments received)' },
  { name: 'Invoices', description: 'GST invoices and their PDFs' },
  { name: 'Expenses', description: 'Expenses and expense categories' },
  { name: 'Employees', description: 'Hotel staff, roles and salary' },
  { name: 'Documents', description: 'Uploaded files (ID proofs, bills) and downloads' },
  { name: 'Gallery', description: 'Website photo gallery' },
  { name: 'Enquiries', description: 'WhatsApp enquiries from the website' },
  { name: 'Reports & dashboard', description: 'Dashboard numbers and income / expense reports' },
  { name: 'Data & storage', description: 'Storage use, export and permanent delete of old data' },
  { name: 'System', description: 'Health check and images' },
];

/** [tag, summary, extra description?] per endpoint. */
export const OPERATIONS = {
  // Auth
  'POST /api/auth/login': ['Auth', 'Log in (get a JWT)', 'In Swagger the returned token is applied automatically, so the locked endpoints work right after this call. Rate limited: 10 failed attempts per 15 min.'],
  'GET /api/auth/me': ['Auth', 'Current admin'],
  'PUT /api/auth/preferences': ['Auth', 'Save sidebar order / hidden pages'],
  'PUT /api/auth/password': ['Auth', 'Change password', 'Logs out every other session and returns a fresh token.'],

  // Public
  'GET /api/public/config': ['Public website', 'Online payment settings'],
  'GET /api/public/hotels': ['Public website', 'Active hotels for the website'],
  'GET /api/public/hotels/:slug': ['Public website', 'One hotel: rooms by type, amenities, gallery, contact'],
  'GET /api/public/hotels/:slug/availability': ['Public website', 'Free rooms for a stay', 'Dates without an offset (e.g. 2026-11-20T12:00) are read as India time. No room numbers or guest data are returned.'],
  'POST /api/public/hotels/:slug/quote': ['Public website', 'Price quote for a selection'],
  'POST /api/public/hotels/:slug/book': ['Public website', 'Book online (instant confirmation)', 'Multipart: `data` = JSON text of the booking, `aadhaarFiles` = 1–2 images/PDF (required when the hotel requires Aadhaar upload). Aadhaar must be a valid 12-digit number. Rate limited: 10 attempts per hour per IP.'],
  'GET /api/public/bookings/status': ['Public website', 'Booking status by reference + phone'],
  'POST /api/public/enquiries': ['Public website', 'Send a WhatsApp enquiry', 'Rate limited: 5 per 15 min per IP.'],

  // System
  'GET /api/health': ['System', 'Health check (database + transactions)'],
  'GET /api/hotels/:id/cover': ['System', 'Hotel cover image'],
  'GET /api/gallery/:id/image': ['System', 'Gallery image'],

  // Hotels
  'GET /api/hotels': ['Hotels', 'List hotels'],
  'POST /api/hotels': ['Hotels', 'Create a hotel', 'JSON, or multipart with the fields plus an optional `cover` image.'],
  'GET /api/hotels/:id': ['Hotels', 'Get a hotel'],
  'PUT /api/hotels/:id': ['Hotels', 'Update a hotel', 'JSON, or multipart with the fields plus an optional `cover` image.'],
  'DELETE /api/hotels/:id': ['Hotels', 'Delete a hotel'],

  // Rooms
  'GET /api/rooms': ['Rooms', 'List rooms of a hotel'],
  'POST /api/rooms': ['Rooms', 'Create a room'],
  'POST /api/rooms/bulk': ['Rooms', 'Create a range of rooms (e.g. 101–110)'],
  'PUT /api/rooms/prices': ['Rooms', 'Set AC / Non-AC prices for many rooms'],
  'GET /api/rooms/available': ['Rooms', 'Rooms free for a period'],
  'PUT /api/rooms/:id': ['Rooms', 'Update a room'],
  'DELETE /api/rooms/:id': ['Rooms', 'Delete a room'],

  // Bookings
  'GET /api/bookings': ['Bookings', 'List bookings'],
  'POST /api/bookings': ['Bookings', 'Create a booking', 'JSON, or multipart with `data` = JSON text of the booking plus optional `files` / `documents` (ID proofs).'],
  'GET /api/bookings/inhouse': ['Bookings', 'Guests checked in now'],
  'GET /api/bookings/by-month': ['Bookings', 'Bookings of a period with full guest details (export)', 'Use one of: `month`, `from` + `to`, or `all=true`. Contains full Aadhaar numbers; every call is logged.'],
  'DELETE /api/bookings/by-month': ['Bookings', 'Permanently delete finished bookings of a period', 'Deletes checked-out / cancelled bookings and their guests\' details. Payments, expenses and invoices are kept. The current month is never deleted.'],
  'GET /api/bookings/:id': ['Bookings', 'Get a booking (with payments, documents, masked Aadhaar)'],
  'PUT /api/bookings/:id': ['Bookings', 'Edit a booking', 'JSON, or multipart with `data` + optional files.'],
  'POST /api/bookings/:id/checkin': ['Bookings', 'Check in'],
  'POST /api/bookings/:id/checkout': ['Bookings', 'Check out'],
  'POST /api/bookings/:id/cancel': ['Bookings', 'Cancel a booking'],
  'POST /api/bookings/:id/payments': ['Bookings', 'Add a payment to a booking'],

  // Online bookings
  'GET /api/online-bookings': ['Online bookings', 'List online bookings'],
  'GET /api/online-bookings/unseen-count': ['Online bookings', 'Number of unseen online bookings'],
  'POST /api/online-bookings/seen-all': ['Online bookings', 'Mark all as seen'],
  'POST /api/online-bookings/:id/seen': ['Online bookings', 'Mark one as seen'],
  'POST /api/online-bookings/:id/reveal-aadhaar': ['Online bookings', 'Reveal the full Aadhaar number', 'Who and when is recorded on the guest.'],

  // Calendar
  'GET /api/calendar': ['Calendar', 'Calendar for a date range (max 62 days)'],

  // Guests
  'GET /api/guests': ['Guests', 'List guests'],
  'POST /api/guests': ['Guests', 'Create a guest'],
  'GET /api/guests/export': ['Guests', 'Download guests as CSV'],
  'GET /api/guests/:id': ['Guests', 'Get a guest with their bookings'],
  'PUT /api/guests/:id': ['Guests', 'Update a guest'],

  // Payments
  'GET /api/payments': ['Payments', 'List income (payments)'],
  'DELETE /api/payments/:id': ['Payments', 'Delete a payment'],

  // Invoices
  'GET /api/invoices': ['Invoices', 'List invoices'],
  'POST /api/invoices': ['Invoices', 'Issue an invoice for a booking'],
  'GET /api/invoices/:id': ['Invoices', 'Get an invoice'],
  'GET /api/invoices/:id/pdf': ['Invoices', 'Invoice PDF'],
  'POST /api/invoices/:id/cancel': ['Invoices', 'Cancel an invoice'],

  // Expenses
  'GET /api/expenses': ['Expenses', 'List expenses'],
  'POST /api/expenses': ['Expenses', 'Add an expense', 'JSON, or multipart with the fields plus an optional `bill` file.'],
  'PUT /api/expenses/:id': ['Expenses', 'Update an expense'],
  'DELETE /api/expenses/:id': ['Expenses', 'Delete an expense'],
  'GET /api/expense-categories': ['Expenses', 'List expense categories'],
  'POST /api/expense-categories': ['Expenses', 'Add an expense category'],
  'DELETE /api/expense-categories/:id': ['Expenses', 'Delete an expense category'],

  // Employees
  'GET /api/employees': ['Employees', 'List employees (with salary summary)'],
  'POST /api/employees': ['Employees', 'Add an employee'],
  'GET /api/employees/:id': ['Employees', 'Get an employee'],
  'PUT /api/employees/:id': ['Employees', 'Update an employee'],
  'DELETE /api/employees/:id': ['Employees', 'Remove an employee'],

  // Documents
  'GET /api/documents': ['Documents', 'List documents of a booking / guest / expense'],
  'POST /api/documents': ['Documents', 'Upload documents', 'Multipart: `ownerType`, `ownerId` and one or more `files`.'],
  'GET /api/documents/:id/file': ['Documents', 'Open / download a document'],
  'DELETE /api/documents/:id': ['Documents', 'Delete a document'],

  // Gallery
  'GET /api/gallery': ['Gallery', 'List gallery images'],
  'POST /api/gallery': ['Gallery', 'Upload gallery images', 'Multipart: `hotelId`, optional `caption`, and one or more `images`.'],
  'PUT /api/gallery/:id': ['Gallery', 'Update caption / order'],
  'DELETE /api/gallery/:id': ['Gallery', 'Delete a gallery image'],

  // Enquiries
  'GET /api/enquiries': ['Enquiries', 'List enquiries'],
  'PUT /api/enquiries/:id': ['Enquiries', 'Update an enquiry status / note'],

  // Reports
  'GET /api/dashboard': ['Reports & dashboard', 'Dashboard numbers'],
  'GET /api/reports/summary': ['Reports & dashboard', 'Income / expense summary for a period'],
  'GET /api/reports/yearly': ['Reports & dashboard', 'Month-by-month report for a year'],

  // Data & storage
  'GET /api/storage': ['Data & storage', 'Storage use and month overview'],
  'DELETE /api/storage/unused-guests': ['Data & storage', 'Delete old guests without bookings'],
  'GET /api/storage/income': ['Data & storage', 'Payments of a period (export)', 'Use one of: `month`, `from` + `to`, or `all=true`.'],
  'DELETE /api/storage/income': ['Data & storage', 'Permanently delete payments of a period', 'Only payments whose booking was already deleted; the current month is kept.'],
  'GET /api/storage/expenses': ['Data & storage', 'Expenses of a period (export)', 'Use one of: `month`, `from` + `to`, or `all=true`.'],
  'DELETE /api/storage/expenses': ['Data & storage', 'Permanently delete expenses of a period', 'Expenses and their bills; the current month is kept.'],
};

/** Upload fields per endpoint: [field, maxCount]. */
export const FILE_FIELDS = {
  'POST /api/hotels': [['cover', 1]],
  'PUT /api/hotels/:id': [['cover', 1]],
  'POST /api/bookings': [['files', 10], ['documents', 10]],
  'PUT /api/bookings/:id': [['files', 10], ['documents', 10]],
  'POST /api/public/hotels/:slug/book': [['aadhaarFiles', 2]],
  'POST /api/expenses': [['bill', 1], ['files', 5]],
  'PUT /api/expenses/:id': [['bill', 1], ['files', 5]],
  'POST /api/documents': [['files', 10]],
  'POST /api/gallery': [['images', 20]],
};

/** Endpoints that answer with a file instead of JSON. */
export const FILE_RESPONSES = {
  'GET /api/hotels/:id/cover': ['image/*', 'The cover image'],
  'GET /api/gallery/:id/image': ['image/*', 'The image'],
  'GET /api/documents/:id/file': ['application/octet-stream', 'The stored file (image or PDF)'],
  'GET /api/invoices/:id/pdf': ['application/pdf', 'Invoice PDF (inline, or a download with ?download=true)'],
  'GET /api/guests/export': ['text/csv', 'Guests as CSV'],
};

/** Ready-to-send examples for the bodies that are hard to type by hand. */
export const EXAMPLES = {
  'POST /api/auth/login': { email: 'admin@gmail.com', password: 'your-password' },
  'POST /api/bookings': {
    hotelId: '<hotel id from GET /api/hotels>',
    guest: { name: 'Ravi Kumar', phone: '9876543210', address: 'Madurai' },
    rooms: [{ roomId: '<room id from GET /api/rooms/available>', type: 'AC' }],
    checkIn: '2026-11-20T12:00',
    checkOut: '2026-11-22T11:00',
    adults: 2,
    children: 0,
    advancePayment: { amount: 1000, mode: 'UPI' },
  },
  'POST /api/public/hotels/:slug/quote': {
    checkIn: '2026-11-20T12:00', checkOut: '2026-11-22T11:00', adults: 2, children: 0, rooms: [{ type: 'AC', quantity: 1 }],
  },
  'POST /api/public/hotels/:slug/book': {
    checkIn: '2026-11-20T12:00',
    checkOut: '2026-11-22T11:00',
    adults: 2,
    children: 0,
    rooms: [{ type: 'AC', quantity: 1 }],
    guest: { name: 'Priya Raman', phone: '9876543210', email: 'priya@example.com', address: '5 North Street, Madurai' },
    aadhaar: '2345 6789 0124',
    consent: true,
  },
  'POST /api/employees': {
    hotelId: '<hotel id>', name: 'Lakshmi Devi', phone: '9876500012', role: 'Housekeeping', salary: 12000, salaryType: 'Monthly', joinDate: '2026-11-01',
  },
};
