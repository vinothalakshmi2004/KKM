// Local test MongoDB for development: `npm run db`
// Runs .mongo/mongod.exe as a one-node replica set (so transactions work) on 127.0.0.1:27017,
// with data kept in .mongo/data. Use with:
//   MONGODB_URI=mongodb://127.0.0.1:27017/kkm?replicaSet=rs0
// Replace MONGODB_URI with your Atlas URL for real use; this script is only for testing.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = path.join(root, '.mongo', process.platform === 'win32' ? 'mongod.exe' : 'mongod');
const dbPath = path.join(root, '.mongo', 'data');
const PORT = 27017;
const REPL_SET = 'rs0';

if (!existsSync(binary)) {
  console.error(`[db] ${binary} not found. Install MongoDB, or put a mongod binary there.`);
  process.exit(1);
}
mkdirSync(dbPath, { recursive: true });

const mongod = spawn(binary, ['--dbpath', dbPath, '--port', String(PORT), '--bind_ip', '127.0.0.1', '--replSet', REPL_SET, '--quiet'], {
  stdio: ['ignore', 'ignore', 'inherit'],
});
mongod.on('exit', (code) => {
  console.log(`[db] mongod exited (${code})`);
  process.exit(code ?? 0);
});

const stop = () => mongod.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// Wait for mongod, then initiate the replica set once (it is remembered in dbPath)
const direct = `mongodb://127.0.0.1:${PORT}/admin?directConnection=true`;
for (let attempt = 1; ; attempt += 1) {
  try {
    const conn = await mongoose.createConnection(direct, { serverSelectionTimeoutMS: 1000 }).asPromise();
    const admin = conn.db.admin();
    try {
      await admin.command({ replSetGetStatus: 1 });
    } catch (err) {
      if (!/no replset config|NotYetInitialized/i.test(err.message)) throw err;
      await admin.command({ replSetInitiate: { _id: REPL_SET, members: [{ _id: 0, host: `127.0.0.1:${PORT}` }] } });
      console.log('[db] Replica set initialised');
    }
    // Wait until this node is primary (writes and transactions allowed)
    for (let i = 0; i < 60; i += 1) {
      const hello = await admin.command({ hello: 1 });
      if (hello.isWritablePrimary) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    await conn.close();
    break;
  } catch (err) {
    if (attempt >= 60) {
      console.error('[db] Could not start MongoDB:', err.message);
      stop();
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

console.log(`[db] MongoDB ready on mongodb://127.0.0.1:${PORT}/kkm?replicaSet=${REPL_SET} (data: .mongo/data). Ctrl+C to stop.`);
