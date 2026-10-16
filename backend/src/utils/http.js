/** Wrap an async route handler so rejections reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, message });

export const created = (res, data, message = 'Created') => ok(res, data, message, 201);

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** page/limit from an already-validated query. */
export const getPaging = (query) => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
};

export const paged = (items, total, { page, limit }) => ({
  items,
  total,
  page,
  pages: Math.max(1, Math.ceil(total / limit)),
});

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
