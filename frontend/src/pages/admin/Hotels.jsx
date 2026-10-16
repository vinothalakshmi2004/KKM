import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getHotels, createHotel, updateHotel, deleteHotel, listOf, API_ORIGIN } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { Plus, Edit2, Trash2, MapPin, Phone, Mail, Building2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatClock } from '../../utils/date';
import { SkeletonGrid } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(2),
  address: z.string().min(3),
  area: z.string().optional(),
  city: z.string().min(2),
  phone: z.string().min(10),
  whatsappNumber: z.string().min(10),
  email: z.string().email().optional().or(z.literal('')),
  description: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  mapEmbedUrl: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  gstPercent: z.string().optional(),
  gstin: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{2}[A-Za-z]{5}\d{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$/.test(v), 'Enter a valid 15-character GSTIN')
    .optional(),
  isActive: z.boolean().default(true),
  onlineBookingEnabled: z.boolean().default(true),
  requireAadhaarUpload: z.boolean().default(true),
  onlineBookingNote: z.string().max(1000).optional(),
});

const BOOL_FIELDS = ['isActive', 'onlineBookingEnabled', 'requireAadhaarUpload'];

// The API may return numbers or nulls (lat, lng, email…); the form only deals in strings
const toFormValues = (hotel) => {
  const values = {};
  Object.keys(schema.shape).forEach((k) => {
    if (!BOOL_FIELDS.includes(k)) values[k] = hotel[k] == null ? '' : String(hotel[k]);
  });
  // Missing on older hotels = the default (true)
  BOOL_FIELDS.forEach((k) => { values[k] = hotel[k] !== false; });
  return values;
};

function HotelModal({ hotel, onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: hotel
      ? toFormValues(hotel)
      : { isActive: true, onlineBookingEnabled: true, requireAadhaarUpload: true, checkInTime: '12:00', checkOutTime: '11:00' },
  });
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      // Backend expects the fields as JSON in "data", plus an optional "cover" file
      const payload = {
        ...data,
        lat: data.lat === '' ? null : data.lat,
        lng: data.lng === '' ? null : data.lng,
        gstPercent: data.gstPercent === '' || data.gstPercent === undefined ? 0 : Number(data.gstPercent),
      };
      const fd = new FormData();
      fd.append('data', JSON.stringify(payload));
      if (coverFile) fd.append('cover', coverFile);
      if (hotel) {
        await updateHotel(hotel._id || hotel.id, fd);
        toast.success('Hotel updated');
        onSaved();
      } else {
        const res = await createHotel(fd);
        onSaved(res.data?.data || res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save hotel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      as="form"
      onSubmit={handleSubmit(onSubmit)}
      title={hotel ? 'Edit Hotel' : 'Add New Hotel'}
      subtitle={hotel ? hotel.name : 'Details shown on the website and invoices'}
      icon={Building2}
      size="xl"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : (hotel ? 'Save Changes' : 'Create Hotel')}
          </button>
        </>
      }
    >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Hotel Name *</label>
            <input {...register('name')} className="input" placeholder="e.g. KKM Grand" />
            {errors.name && <p className="form-error">{errors.name.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address *</label>
            <input {...register('address')} className="input" />
            {errors.address && <p className="form-error">{errors.address.message}</p>}
          </div>
          <div>
            <label className="label">Area / Location</label>
            <input {...register('area')} className="input" placeholder="e.g. Mukkusalai" />
          </div>
          <div>
            <label className="label">City *</label>
            <input {...register('city')} className="input" />
            {errors.city && <p className="form-error">{errors.city.message}</p>}
          </div>
          <div>
            <label className="label">Phone *</label>
            <input {...register('phone')} className="input" />
            {errors.phone && <p className="form-error">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="label">WhatsApp Number *</label>
            <input {...register('whatsappNumber')} className="input" placeholder="91XXXXXXXXXX" />
            {errors.whatsappNumber && <p className="form-error">{errors.whatsappNumber.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email</label>
            <input type="email" {...register('email')} className="input" />
            {errors.email && <p className="form-error">{errors.email.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea {...register('description')} className="input resize-none" rows={3} />
          </div>
          <div>
            <label className="label">Check-in Time</label>
            <input type="time" {...register('checkInTime')} className="input" />
          </div>
          <div>
            <label className="label">Check-out Time</label>
            <input type="time" {...register('checkOutTime')} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Google Maps Embed URL</label>
            <input {...register('mapEmbedUrl')} className="input" placeholder="https://maps.google.com/…" />
          </div>
          <div>
            <label className="label">Latitude</label>
            <input {...register('lat')} className="input" placeholder="11.0168" />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input {...register('lng')} className="input" placeholder="76.9558" />
          </div>
          <div>
            <label className="label">Default GST (%)</label>
            <input type="number" {...register('gstPercent')} className="input" min={0} max={100} step="0.01" placeholder="e.g. 12" />
            <p className="text-xs text-ink-400 mt-1">Pre-filled on new bookings for this hotel</p>
          </div>
          <div>
            <label className="label">GSTIN</label>
            <input {...register('gstin')} className="input uppercase" maxLength={15} placeholder="e.g. 33ABCDE1234F1Z5" />
            {errors.gstin ? <p className="form-error">{errors.gstin.message}</p> : <p className="text-xs text-ink-400 mt-1">Optional. Printed on invoices</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Cover Image</label>
            {hotel?.coverUrl && !coverFile && (
              <img src={`${API_ORIGIN}${hotel.coverUrl}`} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCoverFile(e.target.files[0])} className="input py-1.5" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <input type="checkbox" {...register('isActive')} id="isActive" className="w-4 h-4 accent-brand-500" />
            <label htmlFor="isActive" className="text-sm text-ink-700 dark:text-ink-300">Active (visible on public site)</label>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-ink-200 dark:border-ink-700 p-4 space-y-3">
            <p className="text-sm font-semibold text-ink-900 dark:text-white">Online booking</p>
            <div className="flex items-center gap-3">
              <input type="checkbox" {...register('onlineBookingEnabled')} id="onlineBookingEnabled" className="w-4 h-4 accent-brand-500" />
              <label htmlFor="onlineBookingEnabled" className="text-sm text-ink-700 dark:text-ink-300">Guests can book online (confirmed instantly)</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" {...register('requireAadhaarUpload')} id="requireAadhaarUpload" className="w-4 h-4 accent-brand-500" />
              <label htmlFor="requireAadhaarUpload" className="text-sm text-ink-700 dark:text-ink-300">Aadhaar card upload is required</label>
            </div>
            <div>
              <label className="label">Note for guests</label>
              <textarea {...register('onlineBookingNote')} rows={2} className="input resize-none" maxLength={1000} placeholder="e.g. Please carry your original Aadhaar card at check-in." />
              <p className="text-xs text-ink-400 mt-1">Shown on the booking page before the guest confirms</p>
            </div>
          </div>
        </div>
    </Modal>
  );
}

export default function Hotels() {
  const [modal, setModal] = useState(null); // null | 'add' | hotel object
  const [deleting, setDeleting] = useState(null);
  const queryClient = useQueryClient();
  const { selectHotel, selectedHotelId } = useHotel();

  const { data: hotels = [], isLoading } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => getHotels().then((r) => listOf(r)),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteHotel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      toast.success('Hotel deleted');
      setDeleting(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete hotel'),
  });

  const switchTo = (hotel) => {
    selectHotel(hotel._id);
    toast.success(`Now managing ${hotel.name}`, { id: 'hotel-switch' });
  };

  const handleSaved = (createdHotel) => {
    queryClient.invalidateQueries({ queryKey: ['hotels'] });
    setModal(null);
    // A new hotel becomes the current one, so the rooms you add next go to it
    if (createdHotel?._id) {
      selectHotel(createdHotel._id);
      toast.success(`${createdHotel.name} created and selected. Add its rooms next.`);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hotels</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            Rooms, bookings, guests, income and expenses are kept separately for each hotel. Select the hotel you want to work on.
          </p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Hotel
        </button>
      </div>

      {isLoading ? (
        <SkeletonGrid count={3} />
      ) : hotels.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hotels yet"
          description="Add your first hotel to get started with the booking system."
          action={() => setModal('add')}
          actionLabel="Add Hotel"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {hotels.map((hotel) => (
            <div
              key={hotel._id || hotel.id}
              className={`card hover:shadow-md transition-shadow overflow-hidden ${hotel._id === selectedHotelId ? 'ring-2 ring-brand-500' : ''}`}
            >
              {hotel.coverUrl && (
                <img src={`${API_ORIGIN}${hotel.coverUrl}`} alt="" className="-mx-5 -mt-5 mb-4 h-32 w-[calc(100%+2.5rem)] max-w-none object-cover" />
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink-900 dark:text-white">{hotel.name}</h3>
                    {hotel._id === selectedHotelId && <span className="badge-blue mr-1">Selected</span>}
                    {hotel.isActive !== false ? (
                      <span className="badge badge-green"><CheckCircle className="w-3 h-3 mr-1" />Active</span>
                    ) : (
                      <span className="badge badge-slate"><XCircle className="w-3 h-3 mr-1" />Inactive</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setModal(hotel)} className="btn-ghost p-2"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => setDeleting(hotel)} className="btn-ghost p-2 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-ink-500 dark:text-ink-400">
                <p className="flex items-start gap-2"><MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />{hotel.address}{hotel.city ? `, ${hotel.city}` : ''}</p>
                {hotel.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4" />{hotel.phone}</p>}
                {hotel.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4 flex-shrink-0" /><span className="truncate">{hotel.email}</span></p>}
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  Check-in {formatClock(hotel.checkInTime)} · Check-out {formatClock(hotel.checkOutTime)}
                </p>
              </div>
              <div className="flex gap-2 mt-4">
                {hotel._id === selectedHotelId ? (
                  <span className="btn-secondary text-xs flex-1 cursor-default bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                    <CheckCircle className="w-3.5 h-3.5" /> Currently managing
                  </span>
                ) : (
                  <button onClick={() => switchTo(hotel)} className="btn-primary text-xs flex-1">
                    Switch to this hotel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === 'add' || modal?._id || modal?.id) && (
        <HotelModal
          hotel={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete Hotel"
        message={`Are you sure you want to delete "${deleting?.name}"? This cannot be undone.`}
        onConfirm={() => deleteMut.mutate(deleting._id || deleting.id)}
        loading={deleteMut.isPending}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
