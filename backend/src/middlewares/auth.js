import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Admin } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/http.js';

export const signToken = (admin) =>
  jwt.sign({ sub: String(admin._id), role: admin.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

/**
 * True if the token was issued before the admin's last password change.
 * `iat` has 1-second resolution; the change-password response waits >1s before
 * signing its new token, so that token always passes.
 */
export const tokenRevoked = (admin, payload) =>
  Boolean(admin.passwordChangedAt) && payload.iat * 1000 < admin.passwordChangedAt.getTime();

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token');
  }

  const admin = await Admin.findById(payload.sub).select('+passwordChangedAt');
  if (!admin) throw ApiError.unauthorized('Account no longer exists');
  if (tokenRevoked(admin, payload)) throw ApiError.unauthorized('Password was changed, please log in again');
  req.user = admin;
  next();
});
