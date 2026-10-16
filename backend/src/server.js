import http from 'node:http';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { runMigrations } from './config/migrations.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';
import { ensureAdmin } from './seed/seedAdmin.js';

async function start() {
  await connectDB();
  await runMigrations();
  await ensureAdmin();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSockets(server);

  server.listen(env.port, () => {
    console.log(`[server] API listening on http://localhost:${env.port}/api (${env.nodeEnv})`);
    console.log(`[server] Allowed origins: ${env.clientOrigins.join(', ')}`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down…`);
    // Socket.IO clients and keep-alive connections would otherwise keep the port open
    io.close();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    server.closeIdleConnections();
    setTimeout(() => server.closeAllConnections(), 2_000).unref();
    setTimeout(() => process.exit(1), 5_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Log anything that escapes the request pipeline instead of dying silently
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception, exiting:', err);
  process.exit(1);
});

start().catch((err) => {
  console.error('[server] Failed to start:', err.message);
  process.exit(1);
});
