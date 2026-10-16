import bcrypt from 'bcryptjs';
import { Admin } from '../models/index.js';
import { signToken } from '../middlewares/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const publicUser = (admin) => ({
  _id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  preferences: { sidebar: { order: admin.preferences?.sidebar?.order || [], hidden: admin.preferences?.sidebar?.hidden || [] } },
});

/** Save the admin's own portal preferences (sidebar order / hidden pages). */
export async function updatePreferences(req, res) {
  const admin = await Admin.findById(req.user._id);
  if (req.body.sidebar) {
    admin.set('preferences.sidebar.order', req.body.sidebar.order);
    admin.set('preferences.sidebar.hidden', req.body.sidebar.hidden);
  }
  await admin.save();
  ok(res, publicUser(admin), 'Preferences saved');
}

export async function login(req, res) {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email }).select('+passwordHash');
  // Same message whether the email or the password is wrong
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  ok(res, { token: signToken(admin), user: publicUser(admin) }, 'Logged in');
}

export async function me(req, res) {
  ok(res, publicUser(req.user));
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const admin = await Admin.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect');
  }
  admin.passwordHash = await bcrypt.hash(newPassword, 12);
  // Log out every other session; tokens are second-resolution, so wait a moment
  // to make sure the fresh token below is issued after this timestamp
  admin.passwordChangedAt = new Date();
  await admin.save();
  await new Promise((r) => setTimeout(r, 1100));
  ok(res, { token: signToken(admin), user: publicUser(admin) }, 'Password changed. Other sessions have been logged out.');
}
