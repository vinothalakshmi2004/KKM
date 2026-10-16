import { Document } from '../models/index.js';
import { uploadFiles, deleteFiles } from '../config/gridfs.js';

/**
 * Push files into GridFS before any database write, so a failed upload never
 * leaves a half-saved record. Returns descriptors to pass to createDocuments().
 * Call discardUploads() if the surrounding operation fails afterwards.
 */
export async function stageUploads(files, { hotelId, ownerType }) {
  if (!files?.length) return [];
  const ids = await uploadFiles(files, { hotelId: String(hotelId), ownerType });
  return files.map((file, i) => ({
    fileId: ids[i],
    originalName: file.originalname,
    mimeType: file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype,
    size: file.size,
  }));
}

export const discardUploads = (staged) => deleteFiles((staged || []).map((s) => s.fileId));

export async function createDocuments(staged, { ownerType, ownerId, hotelId }, session) {
  if (!staged?.length) return [];
  return Document.insertMany(
    staged.map((s) => ({ ...s, ownerType, ownerId, hotelId, uploadedAt: new Date() })),
    { session }
  );
}

/** Delete documents (and their GridFS files) for the given owners. */
export async function deleteDocumentsFor(ownerType, ownerIds) {
  const docs = await Document.find({ ownerType, ownerId: { $in: ownerIds } }, { fileId: 1 });
  await deleteFiles(docs.map((d) => d.fileId));
  await Document.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
}
