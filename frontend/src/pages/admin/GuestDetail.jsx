import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getGuest, updateGuest, uploadDocument, getDocumentFile, deleteDocument } from '../../api/services';
import { formatDate, formatDateTime } from '../../utils/date';
import { formatINR } from '../../utils/currency';
import { SkeletonCard } from '../../components/Skeleton';
import FileUpload from '../../components/FileUpload';
import ConfirmDialog from '../../components/ConfirmDialog';
import { ChevronLeft, Phone, Mail, MapPin, CreditCard, Pencil, FileText, Download, Eye, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatRooms } from '../../utils/rooms';
import ScreenOverlay from '../../components/ScreenOverlay';

const STATUS_BADGE = {
  Booked: 'badge-blue', 'Checked-in': 'badge-green', 'Checked-out': 'badge-slate', Cancelled: 'badge-red',
};

const guestSchema = z.object({
  name: z.string().min(2, 'Name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  address: z.string().optional(),
  idProofType: z.string().optional(),
  idProofNumber: z.string().optional(),
});

async function openDocument(doc, download) {
  try {
    const res = await getDocumentFile(doc._id);
    const url = URL.createObjectURL(res.data);
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName || 'document';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  } catch {
    toast.error('Could not open the document');
  }
}

function DocumentRow({ doc, onDelete, tag }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-ink-50 dark:bg-ink-700/50 rounded-lg">
      <FileText className="w-5 h-5 text-ink-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-700 dark:text-ink-200 truncate">{doc.originalName}</p>
        <p className="text-xs text-ink-400">
          {formatDateTime(doc.uploadedAt)} · {Math.max(1, Math.round(doc.size / 1024))} KB{tag && ` · ${tag}`}
        </p>
      </div>
      <button onClick={() => openDocument(doc, false)} className="btn-ghost p-1.5" title="View"><Eye className="w-4 h-4" /></button>
      <button onClick={() => openDocument(doc, true)} className="btn-ghost p-1.5 text-brand-600" title="Download"><Download className="w-4 h-4" /></button>
      {onDelete && (
        <button onClick={() => onDelete(doc)} className="btn-ghost p-1.5 text-ink-400 hover:text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
      )}
    </div>
  );
}

/** Guest documents (ID proofs etc.). Uploading is optional. */
function GuestDocuments({ guest }) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState([]);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['guest', guest._id] });

  const uploadMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('ownerType', 'guest');
      fd.append('ownerId', guest._id);
      files.forEach((f) => fd.append('files', f));
      return uploadDocument(fd);
    },
    onSuccess: () => {
      toast.success(`${files.length} document(s) uploaded`);
      setFiles([]);
      setUploaderKey((k) => k + 1); // clear the picker
      refresh();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Upload failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (doc) => deleteDocument(doc._id),
    onSuccess: () => { toast.success('Document deleted'); setDeleting(null); refresh(); },
    onError: () => toast.error('Failed to delete document'),
  });

  const own = guest.documents || [];
  const fromBookings = guest.bookingDocuments || [];

  return (
    <div className="card">
      <h3 className="font-semibold text-ink-900 dark:text-white mb-1">Documents</h3>
      <p className="text-xs text-ink-400 mb-4">ID proof, address proof etc. Optional: upload only if you have them.</p>

      {own.length + fromBookings.length === 0 ? (
        <p className="text-sm text-ink-400 italic mb-4">No documents yet</p>
      ) : (
        <div className="space-y-2 mb-4">
          {own.map((d) => <DocumentRow key={d._id} doc={d} onDelete={setDeleting} />)}
          {fromBookings.map((d) => <DocumentRow key={d._id} doc={d} tag={`from booking ${d.bookingNo || ''}`} />)}
        </div>
      )}

      <FileUpload key={uploaderKey} onFiles={setFiles} multiple label="Add documents" />
      {files.length > 0 && (
        <button onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending} className="btn-primary mt-3">
          <Upload className="w-4 h-4" /> {uploadMut.isPending ? 'Uploading…' : `Upload ${files.length} file(s)`}
        </button>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete Document"
        message={`Delete ${deleting?.originalName}?`}
        onConfirm={() => deleteMut.mutate(deleting)}
        onCancel={() => setDeleting(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}

function EditGuestModal({ guest, onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      name: guest.name || '',
      phone: guest.phone || '',
      email: guest.email || '',
      address: guest.address || '',
      idProofType: guest.idProofType || '',
      idProofNumber: guest.idProofNumber || '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => updateGuest(guest._id || guest.id, data),
    onSuccess: () => {
      toast.success('Guest updated');
      queryClient.invalidateQueries({ queryKey: ['guest', guest._id || guest.id] });
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update guest'),
  });

  return (
    <ScreenOverlay>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card max-w-lg w-full shadow-2xl">
        <h3 className="section-title mb-5">Edit Guest</h3>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input {...register('name')} className="input" />
            {errors.name && <p className="form-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Phone *</label>
            <input {...register('phone')} className="input" />
            {errors.phone && <p className="form-error">{errors.phone.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email</label>
            <input type="email" {...register('email')} className="input" />
            {errors.email && <p className="form-error">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">ID Proof Type</label>
            <select {...register('idProofType')} className="input">
              <option value="">Select…</option>
              <option>Aadhaar</option>
              <option>PAN</option>
              <option>Passport</option>
              <option>Voter ID</option>
              <option>Driving License</option>
            </select>
          </div>
          <div>
            <label className="label">ID Proof Number</label>
            <input {...register('idProofNumber')} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <textarea {...register('address')} className="input resize-none" rows={2} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ScreenOverlay>
  );
}

export default function GuestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const { data: guest, isLoading } = useQuery({
    queryKey: ['guest', id],
    queryFn: () => getGuest(id).then((r) => r.data?.data || r.data),
  });

  const bookings = guest?.bookings || [];

  if (isLoading) return <div className="space-y-4"><SkeletonCard lines={6} /><SkeletonCard lines={4} /></div>;
  if (!guest) return <div className="text-center py-16 text-ink-400">Guest not found</div>;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/guests')} className="btn-ghost p-2"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="page-title flex-1">{guest.name}</h1>
        <button onClick={() => setEditing(true)} className="btn-secondary"><Pencil className="w-4 h-4" /> Edit</button>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-2xl">
            {guest.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-900 dark:text-white">{guest.name}</h2>
            <p className="text-sm text-ink-500">Guest since {formatDate(guest.createdAt)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {guest.phone && (
            <div className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
              <Phone className="w-4 h-4 text-ink-400" />{guest.phone}
            </div>
          )}
          {guest.email && (
            <div className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
              <Mail className="w-4 h-4 text-ink-400" />{guest.email}
            </div>
          )}
          {guest.address && (
            <div className="flex items-start gap-2 text-ink-600 dark:text-ink-300 sm:col-span-2">
              <MapPin className="w-4 h-4 text-ink-400 mt-0.5 flex-shrink-0" />{guest.address}
            </div>
          )}
          {guest.idProofType && (
            <div className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
              <CreditCard className="w-4 h-4 text-ink-400" />
              {guest.idProofType}: {guest.idProofNumber}
            </div>
          )}
        </div>
      </div>

      <GuestDocuments guest={guest} />

      {/* Booking History */}
      <div className="card">
        <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Booking History ({bookings.length})</h3>
        {bookings.length === 0 ? (
          <p className="text-sm text-ink-400 italic">No bookings yet</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <div
                key={b._id || b.id}
                onClick={() => navigate(`/admin/bookings/${b._id || b.id}`)}
                className="flex items-center gap-4 p-3 bg-ink-50 dark:bg-ink-700/50 rounded-lg cursor-pointer hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 dark:text-white">
                    Room {formatRooms(b.rooms)}
                  </p>
                  <p className="text-xs text-ink-400">{formatDate(b.checkIn)} → {formatDate(b.checkOut)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">{formatINR(b.grandTotal)}</p>
                  <span className={`badge ${STATUS_BADGE[b.status] || 'badge-slate'}`}>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && <EditGuestModal guest={guest} onClose={() => setEditing(false)} />}
    </div>
  );
}
