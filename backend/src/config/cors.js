import { env, isProd } from './env.js';

// Dev servers are often opened as 127.0.0.1 or via the LAN address CRA/Vite print
// ("On Your Network: http://192.168.x.x:3000"), not just "localhost".
const LOCAL_DEV_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

const warned = new Set();

export const isAllowedOrigin = (origin) => {
  const normalized = origin.replace(/\/$/, '');
  if (env.clientOrigins.includes(normalized)) return true;
  // Outside production, any local / private-network dev server is allowed
  if (!isProd && LOCAL_DEV_ORIGIN.test(normalized)) return true;
  return false;
};

/**
 * Shared by Express CORS and Socket.IO.
 * Requests without an Origin header (curl, server-to-server, same-origin) are allowed.
 */
export const corsOrigin = (origin, callback) => {
  if (!origin || isAllowedOrigin(origin)) return callback(null, true);
  // The browser hides CORS failures from the app, so say it here (once per origin)
  if (!warned.has(origin)) {
    warned.add(origin);
    console.warn(
      `[cors] Blocked request from origin ${origin}. If this is your frontend, add it to CLIENT_URL in .env ` +
        `(comma-separated), e.g. CLIENT_URL=${[...env.clientOrigins, origin].join(',')}`
    );
  }
  callback(null, false);
};

export const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 600,
};
