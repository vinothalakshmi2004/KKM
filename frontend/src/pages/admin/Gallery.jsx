import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGallery, uploadGalleryImage, updateGalleryImage, deleteGalleryImage, getGalleryImageUrl, listOf } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import Lightbox from '../../components/Lightbox';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import { SkeletonGrid } from '../../components/Skeleton';
import { Trash2, Edit2, ZoomIn, Image as ImageIcon, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import ScreenOverlay from '../../components/ScreenOverlay';

export default function Gallery() {
  const { selectedHotelId } = useHotel();
  const queryClient = useQueryClient();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const [editCaption, setEditCaption] = useState(null);
  const [captionValue, setCaptionValue] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['gallery', selectedHotelId],
    queryFn: () => getGallery(selectedHotelId).then(listOf),
    enabled: !!selectedHotelId,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteGalleryImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      toast.success('Image deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Failed to delete image'),
  });

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = ''; // allow re-selecting the same file
    if (!files.length) return;
    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('image', file);
        fd.append('hotelId', selectedHotelId);
        await uploadGalleryImage(fd);
        uploaded += 1;
      }
      toast.success(`${uploaded} image(s) uploaded`);
    } catch {
      toast.error(uploaded ? `Uploaded ${uploaded} of ${files.length}; the rest failed` : 'Upload failed');
    } finally {
      // Show whatever made it, even after a partial failure
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      setUploading(false);
    }
  };

  const handleSaveCaption = async () => {
    try {
      await updateGalleryImage(editCaption._id || editCaption.id, { caption: captionValue });
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      toast.success('Caption updated');
      setEditCaption(null);
    } catch {
      toast.error('Failed to update caption');
    }
  };

  const imageUrls = images.map((img) => getGalleryImageUrl(img._id || img.id));

  if (!selectedHotelId) return <EmptyState title="No hotel selected" />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Gallery</h1>
        <label className={`btn-primary cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading…' : 'Upload Images'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {isLoading ? (
        <SkeletonGrid count={6} />
      ) : images.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No images yet"
          description="Upload images to showcase your hotel on the public page."
          action={() => document.querySelector('input[type=file]')?.click()}
          actionLabel="Upload Images"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img, i) => (
            <div key={img._id || img.id} className="group relative rounded-xl overflow-hidden bg-ink-100 dark:bg-ink-800 aspect-square">
              <img
                src={getGalleryImageUrl(img._id || img.id)}
                alt={img.caption || `Gallery ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center gap-2">
                <button
                  onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setEditCaption(img); setCaptionValue(img.caption || ''); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur-sm"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleting(img)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-red-700/80 hover:bg-red-700 text-white rounded-lg backdrop-blur-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {img.caption && (
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-white text-xs truncate">
                  {img.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Caption editor */}
      {editCaption && (
        <ScreenOverlay>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-sm w-full shadow-2xl">
            <h3 className="section-title mb-4">Edit Caption</h3>
            <input
              className="input mb-4"
              value={captionValue}
              onChange={(e) => setCaptionValue(e.target.value)}
              placeholder="Image caption…"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditCaption(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveCaption} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
        </ScreenOverlay>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete Image"
        message="Delete this image from the gallery? This cannot be undone."
        onConfirm={() => deleteMut.mutate(deleting._id || deleting.id)}
        loading={deleteMut.isPending}
        onCancel={() => setDeleting(null)}
      />

      {lightboxOpen && (
        <Lightbox images={imageUrls} startIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
