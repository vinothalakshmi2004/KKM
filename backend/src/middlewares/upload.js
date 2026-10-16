import multer from 'multer';
import path from 'node:path';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const FILE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

const makeFilter = (allowedExts) => (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const ok = allowedExts.includes(ext) && FILE_TYPES[ext] === (file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype);
  if (ok) return cb(null, true);
  cb(ApiError.badRequest(`Unsupported file "${file.originalname}". Allowed: ${allowedExts.join(', ')}`));
};

const build = (allowedExts) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.maxUploadBytes, files: 20 },
    fileFilter: makeFilter(allowedExts),
  });

/** Images and PDFs (documents, bills). */
export const uploadAny = build(Object.keys(FILE_TYPES));
/** Images only (gallery, hotel cover). */
export const uploadImages = build(IMAGE_EXTS);

/** Flatten req.files from upload.fields() into a single array. */
export const collectFiles = (req) =>
  Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
