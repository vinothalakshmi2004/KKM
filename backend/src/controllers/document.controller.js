import { Booking, Document, Expense, Guest } from '../models/index.js';
import { deleteFile, streamFile } from '../config/gridfs.js';
import { collectFiles } from '../middlewares/upload.js';
import { createDocuments, discardUploads, stageUploads } from '../services/document.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ok, created } from '../utils/http.js';

const OWNER_MODELS = { booking: Booking, guest: Guest, expense: Expense };

async function findOwner(ownerType, ownerId) {
  const owner = await OWNER_MODELS[ownerType].findById(ownerId, { hotelId: 1 });
  if (!owner) throw ApiError.notFound(`${ownerType[0].toUpperCase()}${ownerType.slice(1)} not found`);
  return owner;
}

export async function upload(req, res) {
  const { ownerType, ownerId } = req.body;
  const files = collectFiles(req);
  if (!files.length) throw ApiError.badRequest('Attach at least one file (field "files")');

  const owner = await findOwner(ownerType, ownerId);
  const staged = await stageUploads(files, { hotelId: owner.hotelId, ownerType });
  try {
    const docs = await createDocuments(staged, { ownerType, ownerId: owner._id, hotelId: owner.hotelId });
    created(res, docs, `${docs.length} document(s) uploaded`);
  } catch (err) {
    await discardUploads(staged);
    throw err;
  }
}

export async function list(req, res) {
  const { ownerType, ownerId } = req.query;
  const items = await Document.find({ ownerType, ownerId }).sort({ uploadedAt: -1 });
  ok(res, items);
}

export async function file(req, res) {
  const doc = await Document.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Document not found');
  const disposition = req.query.download ? 'attachment' : 'inline';
  const found = await streamFile(res, doc.fileId, { contentType: doc.mimeType, filename: doc.originalName, disposition });
  if (!found) throw ApiError.notFound('File is missing from storage');
}

export async function remove(req, res) {
  const doc = await Document.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Document not found');
  await deleteFile(doc.fileId);
  await doc.deleteOne();
  ok(res, null, 'Document deleted');
}
