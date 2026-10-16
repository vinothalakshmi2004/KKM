import { GalleryImage } from '../models/index.js';
import { deleteFile, deleteFiles, streamFile, uploadFiles } from '../config/gridfs.js';
import { collectFiles } from '../middlewares/upload.js';
import { ensureHotel } from '../services/hotel.service.js';
import { ApiError } from '../utils/ApiError.js';
import { getPaging, ok, created, paged } from '../utils/http.js';

export async function list(req, res) {
  const { hotelId } = req.query;
  await ensureHotel(hotelId);
  const paging = getPaging(req.query);
  const [items, total] = await Promise.all([
    GalleryImage.find({ hotelId }).sort({ order: 1, createdAt: 1 }).skip(paging.skip).limit(paging.limit),
    GalleryImage.countDocuments({ hotelId }),
  ]);
  ok(res, paged(items, total, paging));
}

export async function upload(req, res) {
  const { hotelId, caption } = req.body;
  await ensureHotel(hotelId);
  const files = collectFiles(req);
  if (!files.length) throw ApiError.badRequest('Attach at least one image (field "images")');

  const fileIds = await uploadFiles(files, { hotelId, kind: 'gallery' });
  try {
    const last = await GalleryImage.findOne({ hotelId }).sort({ order: -1 });
    const start = (last?.order ?? -1) + 1;
    const items = await GalleryImage.insertMany(
      fileIds.map((fileId, i) => ({ hotelId, fileId, caption: caption || '', order: start + i }))
    );
    created(res, items, `${items.length} image(s) uploaded`);
  } catch (err) {
    await deleteFiles(fileIds);
    throw err;
  }
}

export async function update(req, res) {
  const image = await GalleryImage.findById(req.params.id);
  if (!image) throw ApiError.notFound('Image not found');
  Object.assign(image, req.body);
  await image.save();
  ok(res, image, 'Image updated');
}

export async function remove(req, res) {
  const image = await GalleryImage.findById(req.params.id);
  if (!image) throw ApiError.notFound('Image not found');
  await deleteFile(image.fileId);
  await image.deleteOne();
  ok(res, null, 'Image deleted');
}

/** Public, cached. */
export async function image(req, res) {
  const img = await GalleryImage.findById(req.params.id, { fileId: 1 });
  if (!img) throw ApiError.notFound('Image not found');
  if (req.headers['if-none-match'] === `"${img.fileId}"`) return res.status(304).end();
  const found = await streamFile(res, img.fileId, { cache: true });
  if (!found) throw ApiError.notFound('Image file is missing');
}
