import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET', 'AADHAAR_ENC_KEY'];
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length) {
  console.error(
    `\n[config] Missing required environment variable(s): ${missing.join(', ')}\n` +
      '         Copy .env.example to .env and fill them in, then restart.\n'
  );
  process.exit(1);
}

/** AADHAAR_ENC_KEY: 32 bytes as 64 hex characters (or base64). Anything else stops the server. */
function parseEncKey(value) {
  const raw = value.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    console.error(
      '\n[config] AADHAAR_ENC_KEY must be a 32-byte key: 64 hex characters (or 32 bytes in base64).\n' +
        `         Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n`
    );
    process.exit(1);
  }
  return key;
}

const PAYMENT_MODES = ['dummy', 'razorpay'];

function parseTrustProxy(value) {
  if (value === undefined || value.trim() === '') return 1;
  if (/^(false|0|no)$/i.test(value.trim())) return false;
  if (/^true$/i.test(value.trim())) return true;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : value.trim();
}

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 5000),
  mongodbUri: process.env.MONGODB_URI.trim(),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Comma-separated list, shared by CORS and Socket.IO
  clientOrigins: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  admin: {
    name: process.env.ADMIN_NAME || 'Admin',
    email: process.env.ADMIN_EMAIL?.trim().toLowerCase() || '',
    password: process.env.ADMIN_PASSWORD || '',
  },
  maxUploadBytes: toInt(process.env.MAX_UPLOAD_MB, 10) * 1024 * 1024,
  tz: process.env.TZ || 'Asia/Kolkata',
  // Number of proxies in front of the app (1 = one hosting proxy such as Render/Nginx).
  // Set TRUST_PROXY=false when clients connect directly, so X-Forwarded-For can't be spoofed
  // to dodge rate limits.
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  // Online booking
  aadhaarEncKey: parseEncKey(process.env.AADHAAR_ENC_KEY),
  paymentMode: PAYMENT_MODES.includes(process.env.PAYMENT_MODE?.trim()) ? process.env.PAYMENT_MODE.trim() : 'dummy',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID?.trim() || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() || '',
  },
  onlineMaxActivePerPhone: toInt(process.env.ONLINE_MAX_ACTIVE_PER_PHONE, 3),
};

export const isProd = env.nodeEnv === 'production';
