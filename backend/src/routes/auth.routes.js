import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as ctrl from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

// Strict: 10 attempts per 15 minutes per IP, successful logins don't count
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email('Valid email required'),
  password: z.string().min(1, 'Password required').max(200),
});

const passwordBody = z
  .object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different',
    path: ['newPassword'],
  });

// Admin portal paths, e.g. "/admin/bookings"
const navPath = z.string().trim().regex(/^\/admin(\/[a-z-]+)?$/, 'Invalid page');
const preferencesBody = z.object({
  sidebar: z
    .object({
      order: z.array(navPath).max(50),
      hidden: z.array(navPath).max(50),
    })
    .optional(),
});

router.post('/login', loginLimiter, validate({ body: loginBody }), asyncHandler(ctrl.login));
router.get('/me', requireAuth, asyncHandler(ctrl.me));
router.put('/preferences', requireAuth, validate({ body: preferencesBody }), asyncHandler(ctrl.updatePreferences));
router.put('/password', requireAuth, validate({ body: passwordBody }), asyncHandler(ctrl.changePassword));

export default router;
