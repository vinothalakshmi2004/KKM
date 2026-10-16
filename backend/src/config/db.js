import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * mongodb+srv:// (Atlas) needs a DNS SRV lookup. On some Windows setups Node only gets
 * 127.0.0.1 as its DNS server and the lookup is refused (querySrv ECONNREFUSED), although the
 * system resolves fine. DNS_SERVERS=8.8.8.8,1.1.1.1 forces servers; otherwise a loopback-only
 * list is replaced with public resolvers.
 */
function ensureDnsServers() {
  const forced = (process.env.DNS_SERVERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (forced.length) {
    dns.setServers(forced);
    return;
  }
  const current = dns.getServers();
  if (current.length && current.every((s) => /^(127\.|::1$|\[::1\])/.test(s))) {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
    console.log('[db] Node had only a local DNS server; using public DNS for the MongoDB lookup');
  }
}

/**
 * Database name when the URI has none (Atlas strings often don't, which would mean "test"):
 * "kkm", or an existing database with that name in another case (e.g. "KKM" created in the
 * Atlas UI), since MongoDB refuses names that differ only by case.
 */
async function dbNameFor(uri) {
  const path = uri.replace(/^mongodb(\+srv)?:\/\/[^/]+/, '').split('?')[0].replace(/^\//, '');
  if (path) return undefined;
  const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const { databases } = await client.db('admin').admin().listDatabases({ nameOnly: true });
    return databases.find((d) => d.name.toLowerCase() === 'kkm')?.name || 'kkm';
  } catch {
    return 'kkm';
  } finally {
    await client.close().catch(() => {});
  }
}

let transactionsSupported = false;

export const supportsTransactions = () => transactionsSupported;

export async function connectDB() {
  mongoose.set('strictQuery', true);
  if (env.mongodbUri.startsWith('mongodb+srv://')) ensureDnsServers();
  await mongoose.connect(env.mongodbUri, { dbName: await dbNameFor(env.mongodbUri), serverSelectionTimeoutMS: 15000 });
  console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);

  // Transactions need a replica set (Atlas always is) or a sharded cluster
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName) || hello.msg === 'isdbgrid';
  } catch {
    transactionsSupported = false;
  }

  if (!transactionsSupported) {
    console.warn(
      '[db] WARNING: this MongoDB server does not support transactions (standalone server).\n' +
        '     Bookings will be saved without a transaction; availability is re-checked right before saving,\n' +
        '     but simultaneous bookings for the same room could still race. Use a replica set or Atlas in production.'
    );
  }

  // Wait for Mongoose's automatic index build (unique room numbers, booking lookups, …).
  // init() reuses the build started on connect; calling createIndexes() as well would run
  // a second concurrent build, which can stall on a brand-new replica set.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

/**
 * Run `fn(session)` inside a transaction when the server supports it, else `fn(null)`.
 * withTransaction retries on transient write conflicts, which is how two
 * simultaneous bookings for the same room get serialised.
 */
export async function withOptionalTransaction(fn) {
  if (!transactionsSupported) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
