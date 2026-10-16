import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getRooms, createRoom, bulkCreateRooms, updateRoom, updateRoomPrices, deleteRoom } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { Plus, Edit2, Trash2, X, BedDouble, Layers, IndianRupee, Check, CheckCircle2, Wrench } from 'lucide-react';
import Modal, { ModalSection } from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { formatINR } from '../../utils/currency';
import toast from 'react-hot-toast';

const schema = z.object({
  roomNumber: z.string().min(1, 'Room number required'),
  floor: z.string().optional(),
  bedType: z.string().optional(),
  maxGuests: z.number().min(1).default(2),
  acPrice: z.number({ invalid_type_error: 'AC price is required' }).min(0),
  nonAcPrice: z.number({ invalid_type_error: 'Non-AC price is required' }).min(0),
  status: z.enum(['Available', 'Maintenance']).default('Available'),
  notes: z.string().optional(),
});

const bulkSchema = z.object({
  from: z.number().min(1),
  to: z.number().min(1),
  acPrice: z.number({ invalid_type_error: 'AC price is required' }).min(0),
  nonAcPrice: z.number({ invalid_type_error: 'Non-AC price is required' }).min(0),
  floor: z.string().optional(),
});

const STATUS_BADGE = {
  Available: 'badge-green',
  Maintenance: 'badge-yellow',
  Occupied: 'badge-red',
  Reserved: 'badge-blue',
};

const AMENITY_PRESETS = ['WiFi', 'TV', 'Geyser', 'Hot Water', 'Attached Bathroom', 'Wardrobe', 'Balcony', 'Fan'];

/** Number input with a ₹ prefix. */
function PriceInput({ label, hint, error, tone = 'brand', ...props }) {
  const tones = {
    brand: 'border-brand-200 dark:border-brand-800 bg-brand-50/60 dark:bg-brand-900/10',
    ink: 'border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-900/20',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <label className="text-xs font-semibold text-ink-600 dark:text-ink-300">{label}</label>
      <div className="relative mt-1.5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-medium">₹</span>
        <input type="number" min={0} step="1" inputMode="numeric" className="input pl-7 text-base font-semibold" {...props} />
      </div>
      {hint && !error && <p className="text-[11px] text-ink-400 mt-1">{hint}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/** Two-option switch (used for Available / Maintenance). */
function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex w-full rounded-xl bg-ink-100 dark:bg-ink-900/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            value === o.value
              ? `bg-white dark:bg-ink-700 shadow-sm ${o.activeClass || 'text-brand-700 dark:text-brand-300'}`
              : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-200'
          }`}
        >
          {o.icon && <o.icon className="w-4 h-4" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RoomModal({ room, hotelId, onClose, onSaved }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: room
      ? {
          roomNumber: String(room.roomNumber ?? ''),
          floor: room.floor == null ? '' : String(room.floor),
          bedType: room.bedType || '',
          maxGuests: Number(room.maxGuests) || 2,
          acPrice: Number(room.acPrice) || 0,
          nonAcPrice: Number(room.nonAcPrice) || 0,
          status: room.status === 'Maintenance' ? 'Maintenance' : 'Available',
          notes: room.notes || '',
        }
      : { status: 'Available', maxGuests: 2, acPrice: 1200, nonAcPrice: 800, bedType: 'Double' },
  });
  const [amenityInput, setAmenityInput] = useState('');
  const [amenities, setAmenities] = useState(room?.amenities || []);
  const [saving, setSaving] = useState(false);
  const status = watch('status');
  const maxGuests = watch('maxGuests');

  const toggleAmenity = (a) => setAmenities((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  const addAmenity = () => {
    const a = amenityInput.trim();
    if (a && !amenities.includes(a)) setAmenities([...amenities, a]);
    setAmenityInput('');
  };

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true);
    try {
      const payload = { ...data, amenities, hotelId };
      if (room) await updateRoom(room._id || room.id, payload);
      else await createRoom(payload);
      toast.success(room ? `Room ${data.roomNumber} updated` : `Room ${data.roomNumber} added`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save room');
    } finally {
      setSaving(false);
    }
  });

  const customAmenities = amenities.filter((a) => !AMENITY_PRESETS.includes(a));

  return (
    <Modal
      as="form"
      onSubmit={onSubmit}
      onClose={onClose}
      busy={saving}
      icon={BedDouble}
      size="xl"
      title={room ? `Edit Room ${room.roomNumber}` : 'Add Room'}
      subtitle={room?.liveStatus && ['Occupied', 'Reserved'].includes(room.liveStatus)
        ? `Currently ${room.liveStatus.toLowerCase()} (from bookings)`
        : 'Every room can be booked as AC or Non-AC'}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary min-w-[8rem]">
            {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : room ? 'Save Changes' : 'Add Room'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <ModalSection title="Room details">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Room Number *</label>
              <input {...register('roomNumber')} className="input" placeholder="e.g. 101" autoFocus={!room} />
              {errors.roomNumber && <p className="form-error">{errors.roomNumber.message}</p>}
            </div>
            <div>
              <label className="label">Floor</label>
              <input {...register('floor')} className="input" placeholder="Ground / 1 / 2" />
            </div>
            <div>
              <label className="label">Bed Type</label>
              <select {...register('bedType')} className="input">
                <option value="">—</option>
                <option>Single</option>
                <option>Double</option>
                <option>Twin</option>
                <option>Queen</option>
                <option>King</option>
                <option>Triple</option>
                <option>Dormitory</option>
              </select>
            </div>
            <div>
              <label className="label">Max Guests</label>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary px-3" onClick={() => setValue('maxGuests', Math.max(1, (Number(maxGuests) || 1) - 1))}>−</button>
                <input type="number" {...register('maxGuests', { valueAsNumber: true })} className="input text-center" min={1} />
                <button type="button" className="btn-secondary px-3" onClick={() => setValue('maxGuests', (Number(maxGuests) || 0) + 1)}>+</button>
              </div>
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Price per night" hint="You choose AC or Non-AC for each booking">
          <div className="grid grid-cols-2 gap-3">
            <PriceInput label="❄️ AC" error={errors.acPrice?.message} {...register('acPrice', { valueAsNumber: true })} />
            <PriceInput label="🌀 Non-AC" tone="ink" error={errors.nonAcPrice?.message} {...register('nonAcPrice', { valueAsNumber: true })} />
          </div>
        </ModalSection>

        <ModalSection title="Status">
          <Segmented
            value={status}
            onChange={(v) => setValue('status', v)}
            options={[
              { value: 'Available', label: 'Available', icon: CheckCircle2, activeClass: 'text-emerald-600 dark:text-emerald-400' },
              { value: 'Maintenance', label: 'Maintenance', icon: Wrench, activeClass: 'text-amber-600 dark:text-amber-400' },
            ]}
          />
          {status === 'Maintenance' && <p className="text-xs text-amber-600 dark:text-amber-400">Rooms under maintenance can't be booked.</p>}
        </ModalSection>

        <ModalSection title="Amenities" hint="Tap to add or remove">
          <div className="flex flex-wrap gap-2">
            {AMENITY_PRESETS.map((a) => {
              const on = amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    on
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'border-ink-300 dark:border-ink-600 text-ink-600 dark:text-ink-300 hover:border-brand-400'
                  }`}
                >
                  {on && <Check className="w-3 h-3" />}{a}
                </button>
              );
            })}
            {customAmenities.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-brand-600 text-white">
                {a}
                <button type="button" onClick={() => toggleAmenity(a)} className="hover:text-red-200" aria-label={`Remove ${a}`}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={amenityInput}
              onChange={(e) => setAmenityInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
              className="input flex-1"
              placeholder="Other amenity, e.g. Mini fridge"
            />
            <button type="button" onClick={addAmenity} className="btn-secondary" disabled={!amenityInput.trim()}>Add</button>
          </div>
        </ModalSection>

        <ModalSection title="Notes">
          <textarea {...register('notes')} className="input resize-none" rows={2} placeholder="Optional, e.g. sea-facing, near lift" />
        </ModalSection>
      </div>
    </Modal>
  );
}

function BulkModal({ hotelId, onClose, onSaved }) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(bulkSchema),
    defaultValues: { acPrice: 1200, nonAcPrice: 800 },
  });
  const [saving, setSaving] = useState(false);
  const from = watch('from');
  const to = watch('to');
  const count = Number.isFinite(from) && Number.isFinite(to) && to >= from ? to - from + 1 : 0;

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true);
    try {
      const res = await bulkCreateRooms({ ...data, hotelId });
      toast.success(res.data?.message || `Rooms ${data.from}–${data.to} created`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create rooms');
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      as="form"
      onSubmit={onSubmit}
      onClose={onClose}
      busy={saving}
      icon={Layers}
      size="md"
      title="Bulk Add Rooms"
      subtitle="Create a range of rooms in one go"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button type="submit" disabled={saving || !count} className="btn-primary">
            {saving ? 'Creating…' : count ? `Create ${count} Room${count > 1 ? 's' : ''}` : 'Create Rooms'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <ModalSection title="Room numbers" hint="Existing numbers are skipped">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input type="number" {...register('from', { valueAsNumber: true })} className="input" placeholder="101" autoFocus />
              {errors.from && <p className="form-error">{errors.from.message}</p>}
            </div>
            <div>
              <label className="label">To</label>
              <input type="number" {...register('to', { valueAsNumber: true })} className="input" placeholder="110" />
              {errors.to && <p className="form-error">{errors.to.message}</p>}
            </div>
          </div>
          {count > 0 && (
            <p className="text-sm text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-2">
              Rooms {from} to {to} · {count} room{count > 1 ? 's' : ''}
            </p>
          )}
        </ModalSection>
        <ModalSection title="Price per night">
          <div className="grid grid-cols-2 gap-3">
            <PriceInput label="❄️ AC" error={errors.acPrice?.message} {...register('acPrice', { valueAsNumber: true })} />
            <PriceInput label="🌀 Non-AC" tone="ink" error={errors.nonAcPrice?.message} {...register('nonAcPrice', { valueAsNumber: true })} />
          </div>
        </ModalSection>
        <ModalSection title="Floor">
          <input {...register('floor')} className="input" placeholder="Ground / 1 / 2 (optional)" />
        </ModalSection>
      </div>
    </Modal>
  );
}

/** Set AC / Non-AC prices for every room of the hotel at once. */
function PricesModal({ hotelId, rooms, onClose, onSaved }) {
  const [acPrice, setAcPrice] = useState(rooms[0]?.acPrice ?? '');
  const [nonAcPrice, setNonAcPrice] = useState(rooms[0]?.nonAcPrice ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (acPrice === '' && nonAcPrice === '') { toast.error('Enter at least one price'); return; }
    setSaving(true);
    try {
      const res = await updateRoomPrices({
        hotelId,
        ...(acPrice !== '' ? { acPrice: Number(acPrice) } : {}),
        ...(nonAcPrice !== '' ? { nonAcPrice: Number(nonAcPrice) } : {}),
      });
      toast.success(res.data?.message || 'Prices updated');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update prices');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      onClose={onClose}
      busy={saving}
      icon={IndianRupee}
      size="md"
      title="Update Prices"
      subtitle="Applies to every room in this hotel. Existing bookings keep their rates."
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Update All Rooms'}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <PriceInput label="❄️ AC" hint="Leave empty to keep" value={acPrice} onChange={(e) => setAcPrice(e.target.value)} />
        <PriceInput label="🌀 Non-AC" tone="ink" hint="Leave empty to keep" value={nonAcPrice} onChange={(e) => setNonAcPrice(e.target.value)} />
      </div>
    </Modal>
  );
}

export default function Rooms() {
  const { selectedHotelId } = useHotel();
  const [modal, setModal] = useState(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [pricesModal, setPricesModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['rooms', selectedHotelId, page],
    queryFn: () => getRooms(selectedHotelId, { page, limit: LIMIT }).then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
  });

  const rooms = data?.items || data || [];
  const total = data?.total;
  const pages = data?.pages ?? Math.max(1, Math.ceil((total || 0) / LIMIT));

  useEffect(() => setPage(1), [selectedHotelId]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const deleteMut = useMutation({
    mutationFn: (id) => deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Room deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Failed to delete room'),
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setModal(null);
    setBulkModal(false);
  };

  if (!selectedHotelId) {
    return <EmptyState title="No hotel selected" description="Select a hotel from the top bar to manage its rooms." />;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Rooms</h1>
        <div className="flex flex-wrap gap-2">
          {rooms.length > 0 && (
            <button onClick={() => setPricesModal(true)} className="btn-secondary">
              <IndianRupee className="w-4 h-4" /> Update Prices
            </button>
          )}
          <button onClick={() => setBulkModal(true)} className="btn-secondary">
            <Layers className="w-4 h-4" /> Bulk Add
          </button>
          <button onClick={() => setModal('add')} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Room
          </button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : rooms.length === 0 ? (
        <EmptyState icon={BedDouble} title="No rooms yet" description="Add individual rooms or use bulk add to create multiple rooms at once." action={() => setModal('add')} actionLabel="Add Room" />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {rooms.map((room) => (
              <div key={room._id || room.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-ink-900 dark:text-white text-lg">Room {room.roomNumber}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className={`badge ${STATUS_BADGE[room.liveStatus || room.status] || 'badge-slate'}`}>{room.liveStatus || room.status}</span>
                      {room.currentBooking && <span className="badge badge-slate">{room.currentBooking.guest?.name}</span>}
                    </div>
                    <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
                      AC {formatINR(room.acPrice)} · Non-AC {formatINR(room.nonAcPrice)} /night · {room.bedType || 'Standard'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setModal(room)} className="btn-ghost p-2"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeleting(room)} className="btn-ghost p-2 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {room.amenities?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {room.amenities.map((a) => <span key={a} className="badge badge-slate text-xs">{a}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Room #</th>
                  <th>Floor</th>
                  <th>Bed</th>
                  <th>AC / Night</th>
                  <th>Non-AC / Night</th>
                  <th>Max Guests</th>
                  <th>Amenities</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room._id || room.id}>
                    <td className="font-bold text-ink-900 dark:text-white">{room.roomNumber}</td>
                    <td>{room.floor || '—'}</td>
                    <td>{room.bedType || '—'}</td>
                    <td className="font-medium">{formatINR(room.acPrice)}</td>
                    <td className="font-medium">{formatINR(room.nonAcPrice)}</td>
                    <td>{room.maxGuests}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(room.amenities || []).slice(0, 3).map((a) => (
                          <span key={a} className="badge badge-slate text-xs">{a}</span>
                        ))}
                        {(room.amenities || []).length > 3 && <span className="badge badge-slate text-xs">+{room.amenities.length - 3}</span>}
                      </div>
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[room.liveStatus || room.status] || 'badge-slate'}`}>{room.liveStatus || room.status}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => setModal(room)} className="btn-ghost p-1.5"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setDeleting(room)} className="btn-ghost p-1.5 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </>
      )}

      {(modal === 'add' || modal?._id || modal?.id) && (
        <RoomModal room={modal === 'add' ? null : modal} hotelId={selectedHotelId} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {bulkModal && <BulkModal hotelId={selectedHotelId} onClose={() => setBulkModal(false)} onSaved={handleSaved} />}
      {pricesModal && (
        <PricesModal hotelId={selectedHotelId} rooms={rooms} onClose={() => setPricesModal(false)} onSaved={() => { setPricesModal(false); handleSaved(); }} />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete Room"
        message={`Delete Room ${deleting?.roomNumber}? This cannot be undone.`}
        onConfirm={() => deleteMut.mutate(deleting._id || deleting.id)}
        loading={deleteMut.isPending}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
