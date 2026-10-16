import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.js';
import { supportsTransactions } from '../config/db.js';
import { asyncHandler } from '../utils/http.js';
import { cover } from '../controllers/hotel.controller.js';
import { image } from '../controllers/gallery.controller.js';

import authRoutes from './auth.routes.js';
import publicRoutes from './public.routes.js';
import hotelRoutes from './hotel.routes.js';
import roomRoutes from './room.routes.js';
import guestRoutes from './guest.routes.js';
import bookingRoutes from './booking.routes.js';
import paymentRoutes from './payment.routes.js';
import documentRoutes from './document.routes.js';
import { expenseRouter, categoryRouter } from './expense.routes.js';
import galleryRoutes from './gallery.routes.js';
import enquiryRoutes from './enquiry.routes.js';
import { reportRouter, dashboardRouter } from './report.routes.js';
import calendarRoutes from './calendar.routes.js';
import invoiceRoutes from './invoice.routes.js';
import onlineBookingRoutes from './onlineBooking.routes.js';
import storageRoutes from './storage.routes.js';
import employeeRoutes from './employee.routes.js';

const router = Router();

// ---- Public (no JWT)
router.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    data: { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'connected' : 'disconnected', transactions: supportsTransactions(), uptime: Math.round(process.uptime()) },
  });
});
router.use('/auth', authRoutes); // /auth/me and /auth/password check the JWT themselves
router.use('/public', publicRoutes);
// Images are loaded by <img> tags, which can't send a token
router.get('/hotels/:id/cover', validate({ params: idParams }), asyncHandler(cover));
router.get('/gallery/:id/image', validate({ params: idParams }), asyncHandler(image));

// ---- Everything below requires a valid JWT
router.use(requireAuth);
router.use('/hotels', hotelRoutes);
router.use('/rooms', roomRoutes);
router.use('/guests', guestRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/documents', documentRoutes);
router.use('/expenses', expenseRouter);
router.use('/expense-categories', categoryRouter);
router.use('/gallery', galleryRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/reports', reportRouter);
router.use('/dashboard', dashboardRouter);
router.use('/calendar', calendarRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/online-bookings', onlineBookingRoutes);
router.use('/storage', storageRoutes);
router.use('/employees', employeeRoutes);

export default router;
