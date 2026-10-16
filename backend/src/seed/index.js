// npm run seed: create the admin from .env if none exists, then exit
import '../models/index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { ensureAdmin } from './seedAdmin.js';
import { runMigrations } from '../config/migrations.js';

try {
  await connectDB();
  await runMigrations();
  await ensureAdmin();
  await disconnectDB();
  process.exit(0);
} catch (err) {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
}
