import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { env, isProd } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { formatZodErrors } from './validate.js';

export const notFound = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  // A file stream that fails midway has already sent headers: just drop the connection
  if (res.headersSent) {
    console.error(`[error] ${req.method} ${req.originalUrl} failed after response started:`, err.message);
    return res.destroy();
  }
  // Headers set for a file that never started must not leak onto the JSON error
  // (e.g. a cacheable image Content-Type)
  for (const h of ['Content-Type', 'Content-Length', 'Content-Disposition', 'Cache-Control', 'ETag']) res.removeHeader(h);

  let status = 500;
  let message = 'Something went wrong';
  let errors;

  if (err instanceof ApiError) {
    ({ status, message, errors } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    errors = formatZodErrors(err);
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Maximum size is ${Math.round(env.maxUploadBytes / 1024 / 1024)} MB`
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? `Unexpected file field "${err.field}"`
          : err.message;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || err.keyPattern || {}).filter((k) => k !== 'hotelId').join(', ');
    message = field ? `A record with this ${field} already exists` : 'Duplicate record';
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  }

  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);

  res.status(status).json({
    success: false,
    message,
    errors,
    ...(status >= 500 && !isProd ? { stack: err.stack } : {}),
  });
};
