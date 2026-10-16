import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export const formatZodErrors = (error) =>
  error.issues.map((issue) => ({ field: issue.path.join('.') || undefined, message: issue.message }));

/**
 * Validate and coerce request parts: validate({ params, query, body }).
 * Parsed values replace the originals, so handlers only see clean data.
 */
/**
 * Drop keys whose parsed value is undefined ("" / null sent for an optional field).
 * Otherwise `Object.assign(doc, body)` would copy the undefined and unset the field.
 */
const dropUndefined = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
    ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined))
    : value;

export const validate = (schemas) => (req, _res, next) => {
  try {
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const parsed = dropUndefined(schemas[part].parse(req[part] ?? {}));
      if (part === 'query') {
        // Express 4 exposes req.query as a plain writable object
        Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      } else {
        req[part] = parsed;
      }
    }
    next();
  } catch (err) {
    if (err instanceof ZodError) return next(ApiError.badRequest('Validation failed', formatZodErrors(err)));
    next(err);
  }
};

/**
 * multipart/form-data sends JSON as a string in a "data" field.
 * Parse it into req.body (other plain text fields are merged in underneath).
 */
export const parseMultipartData = (req, _res, next) => {
  if (typeof req.body?.data !== 'string') return next();
  try {
    const { data, ...rest } = req.body;
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    req.body = { ...rest, ...parsed };
    next();
  } catch {
    next(ApiError.badRequest('The "data" field must be a JSON object'));
  }
};
