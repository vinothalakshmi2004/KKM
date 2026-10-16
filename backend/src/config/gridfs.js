import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BUCKET = 'uploads';

export const getBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });

export const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));

/** Store a multer memory file in GridFS; resolves to the new file's ObjectId. */
export function uploadFile(file, metadata = {}) {
  return new Promise((resolve, reject) => {
    const stream = getBucket().openUploadStream(file.originalname, {
      metadata: { ...metadata, mimeType: file.mimetype },
    });
    Readable.from(file.buffer)
      .pipe(stream)
      .on('error', reject)
      .on('finish', () => resolve(stream.id));
  });
}

export async function uploadFiles(files, metadata) {
  const ids = [];
  try {
    for (const file of files) ids.push(await uploadFile(file, metadata));
    return ids;
  } catch (err) {
    await deleteFiles(ids);
    throw err;
  }
}

/** Delete a GridFS file; a file that is already gone is not an error. */
export async function deleteFile(id) {
  if (!id) return;
  try {
    await getBucket().delete(toObjectId(id));
  } catch (err) {
    if (!/FileNotFound|File not found/i.test(err.message)) throw err;
  }
}

export const deleteFiles = (ids) => Promise.all((ids || []).map(deleteFile));

export async function findFile(id) {
  const [file] = await getBucket().find({ _id: toObjectId(id) }).limit(1).toArray();
  return file || null;
}

/** Stream a GridFS file to the response with its stored type. */
export async function streamFile(res, id, { contentType, filename, cache = false, disposition = 'inline' } = {}) {
  const file = await findFile(id);
  if (!file) return false;

  res.set('Content-Type', contentType || file.metadata?.mimeType || 'application/octet-stream');
  res.set('Content-Length', String(file.length));
  if (filename) {
    res.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`);
  }
  if (cache) {
    // GridFS files are immutable (replacing an image creates a new id), so cache hard
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    res.set('ETag', `"${file._id}"`);
  } else {
    res.set('Cache-Control', 'private, no-store');
  }

  try {
    // pipeline() settles on finish, error and client abort, and destroys both streams
    await pipeline(getBucket().openDownloadStream(file._id), res);
  } catch (err) {
    // The client went away mid-download: nothing to report
    if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return true;
    throw err;
  }
  return true;
}
