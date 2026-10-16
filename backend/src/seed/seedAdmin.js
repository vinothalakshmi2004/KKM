import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { Admin } from '../models/index.js';

/** Create the first admin from ADMIN_* env vars if no admin exists yet. */
export async function ensureAdmin({ log = console.log } = {}) {
  if (await Admin.exists({})) {
    log('[seed] Admin already exists, nothing to do');
    return null;
  }

  const { name, email, password } = env.admin;
  if (!email || !password) {
    console.warn('[seed] No admin exists and ADMIN_EMAIL / ADMIN_PASSWORD are not set; set them in .env to create one.');
    return null;
  }
  if (password.length < 8) {
    console.warn('[seed] ADMIN_PASSWORD must be at least 8 characters; admin not created.');
    return null;
  }

  const admin = await Admin.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
  log(`[seed] Created admin ${admin.email}`);
  return admin;
}
