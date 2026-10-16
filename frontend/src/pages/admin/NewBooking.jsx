import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGuests, getAvailableRooms, createBooking, listOf, dataOf } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { diffNights, fromInputDateTime, toInputDate, formatClock, dayjs } from '../../utils/date';
import { formatINR } from '../../utils/currency';
import FileUpload from '../../components/FileUpload';
import {
  Search, User, BedDouble, IndianRupee, FileText,
  ChevronRight, ChevronLeft, Check, X, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

const guestSchema = z.object({
  name: z.string().min(2, 'Name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  idProofType: z.string().optional(),
  idProofNumber: z.string().optional(),
  adults: z.number().min(1).default(1),
  children: z.number().min(0).default(0),
});

const STEPS = ['Guest', 'Stay', 'Amount', 'Documents'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank'];

function ModeToggle({ value, onChange, small }) {
  return (
    <div className="inline-flex rounded-lg border border-ink-200 dark:border-ink-600 overflow-hidden">
      {['AC', 'Non-AC'].map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`${small ? 'px-2.5 py-1 text-xs' : 'px-4 py-1.5 text-sm'} font-medium transition-colors ${
            value === m ? 'bg-brand-600 text-white' : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export default function NewBooking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Set when converting a WhatsApp enquiry into a booking
  const prefill = useLocation().state?.prefill;
  const { selectedHotelId, hotels } = useHotel();
  const hotel = hotels.find((h) => (h._id || h.id) === selectedHotelId);
  const [step, setStep] = useState(0);
  const [guestSearch, setGuestSearch] = useState(prefill?.phone || '');
  const [selectedGuest, setSelectedGuest] = useState(null);
  // How many people stay (for any guest: new or picked from search)
  const [party, setParty] = useState({ adults: Number(prefill?.guests) || 2, children: 0 });
  // Open the new-guest form only when guest details were passed (WhatsApp enquiry)
  const [newGuest, setNewGuest] = useState(!!(prefill?.name || prefill?.phone));
  // Calendar passes plain YYYY-MM-DD dates; enquiries pass ISO timestamps
  const prefillDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : toInputDate(v));
  // Dates and times are picked separately; times default to the hotel's own check-in/out times
  const [ciDate, setCiDate] = useState(() => (prefill?.checkIn ? prefillDate(prefill.checkIn) : ''));
  const [coDate, setCoDate] = useState(() => (prefill?.checkOut ? prefillDate(prefill.checkOut) : ''));
  const [ciTime, setCiTime] = useState(null); // null = use the hotel's default
  const [coTime, setCoTime] = useState(null);
  const hotelCheckIn = hotel?.checkInTime || '12:00';
  const hotelCheckOut = hotel?.checkOutTime || '11:00';
  const checkIn = ciDate ? `${ciDate}T${ciTime ?? hotelCheckIn}` : '';
  const checkOut = coDate ? `${coDate}T${coTime ?? hotelCheckOut}` : '';

  const changeCheckInDate = (value) => {
    setCiDate(value);
    // Suggest a one-night stay when check-out is missing or no longer after check-in
    if (value && (!coDate || coDate <= value)) setCoDate(dayjs(value).add(1, 'day').format('YYYY-MM-DD'));
  };
  // Every room can be let as AC or Non-AC; new selections start with this mode
  const [defaultMode, setDefaultMode] = useState(prefill?.roomType === 'Non-AC' ? 'Non-AC' : 'AC');
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [roomModes, setRoomModes] = useState({}); // roomId → 'AC' | 'Non-AC'
  const [extraLabel, setExtraLabel] = useState('Extra charges');
  const [extraCharges, setExtraCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  // The hotel's GST % is the default; null = not touched yet
  const [gstOverride, setGstOverride] = useState(null);
  const gstPct = gstOverride ?? hotel?.gstPercent ?? 0;
  const setGstPct = setGstOverride;
  const [advancePaid, setAdvancePaid] = useState(0);
  const [advanceMode, setAdvanceMode] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [overrideRates, setOverrideRates] = useState({});
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      name: prefill?.name || '',
      phone: prefill?.phone || '',
      adults: Number(prefill?.guests) || 2,
      children: 0,
    },
  });

  // Guest search
  const { data: guestResults = [] } = useQuery({
    queryKey: ['guests-search', selectedHotelId, guestSearch],
    queryFn: () => getGuests({ hotelId: selectedHotelId, search: guestSearch, limit: 5 }).then(listOf),
    enabled: !!selectedHotelId && guestSearch.length >= 3,
  });

  // Available rooms
  const { data: availableRooms = [] } = useQuery({
    queryKey: ['available-rooms', selectedHotelId, checkIn, checkOut],
    queryFn: () =>
      getAvailableRooms({
        hotelId: selectedHotelId,
        checkIn: fromInputDateTime(checkIn),
        checkOut: fromInputDateTime(checkOut),
      }).then(listOf),
    enabled: !!selectedHotelId && !!checkIn && !!checkOut && checkOut > checkIn && step >= 1,
  });

  // Rooms picked for old dates may no longer be free
  useEffect(() => {
    setSelectedRooms([]);
    setRoomModes({});
    setOverrideRates({});
  }, [checkIn, checkOut]);

  const roomId = (room) => room._id || room.id;
  const modeOf = (room) => roomModes[roomId(room)] || defaultMode;
  const priceOf = (room, mode = modeOf(room)) => (mode === 'Non-AC' ? room.nonAcPrice : room.acPrice);
  // Room chosen on the calendar: select it once it appears in the available rooms for these dates
  const prefillRoomKey = useRef('');
  useEffect(() => {
    const key = `${checkIn}|${checkOut}`;
    if (!prefill?.roomId || prefillRoomKey.current === key || !availableRooms.length) return;
    prefillRoomKey.current = key;
    const room = availableRooms.find((r) => roomId(r) === prefill.roomId);
    if (room) {
      setSelectedRooms([room]);
      setRoomModes({ [prefill.roomId]: defaultMode });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableRooms, checkIn, checkOut]);

  const setMode = (room, mode) => {
    setRoomModes((prev) => ({ ...prev, [roomId(room)]: mode }));
    // The rate follows the mode's price unless it is overridden again
    setOverrideRates((prev) => {
      const { [roomId(room)]: _, ...rest } = prev;
      return rest;
    });
  };

  // Preview only: the server recalculates every total
  const nights = checkIn && checkOut ? diffNights(checkIn, checkOut) : 0;
  const roomTotal = selectedRooms.reduce((sum, room) => {
    const rate = overrideRates[roomId(room)] ?? priceOf(room);
    return sum + rate * nights;
  }, 0);
  const subtotal = roomTotal + Number(extraCharges) - Number(discount);
  const gstAmt = subtotal * (Number(gstPct) / 100);
  const grandTotal = subtotal + gstAmt;
  const balance = grandTotal - Number(advancePaid);

  const toggleRoom = (room) => {
    const id = room._id || room.id;
    const isSelected = selectedRooms.some((r) => (r._id || r.id) === id);
    setSelectedRooms((prev) => (isSelected ? prev.filter((r) => (r._id || r.id) !== id) : [...prev, room]));
    if (!isSelected) setRoomModes((prev) => ({ ...prev, [id]: prev[id] || defaultMode }));
  };

  const handleSubmitBooking = async () => {
    if (!selectedGuest) { toast.error('Select or create a guest'); return; }
    if (selectedRooms.length === 0) { toast.error('Select at least one room'); return; }
    if (subtotal < 0) { toast.error('Discount is more than the room total plus extras'); return; }
    if (balance < 0) { toast.error('Advance paid exceeds grand total'); return; }
    setSaving(true);
    try {
      const { isNew, adults, children, _id, id, ...guestFields } = selectedGuest;
      const payload = {
        hotelId: selectedHotelId,
        // Existing guest by id; a new guest is created (or matched by phone) by the server
        ...(isNew
          ? { guest: { ...guestFields, email: guestFields.email || undefined } }
          : { guestId: _id || id }),
        rooms: selectedRooms.map((r) => {
          const override = overrideRates[roomId(r)];
          return {
            roomId: roomId(r),
            type: modeOf(r),
            ...(override !== undefined && override !== priceOf(r) ? { ratePerNight: override } : {}),
          };
        }),
        checkIn: fromInputDateTime(checkIn),
        checkOut: fromInputDateTime(checkOut),
        adults: Math.max(1, Number(party.adults) || 1),
        children: Math.max(0, Number(party.children) || 0),
        extraCharges: Number(extraCharges) > 0 ? [{ label: extraLabel.trim() || 'Extra charges', amount: Number(extraCharges) }] : [],
        discount: Number(discount) || 0,
        gstPercent: Number(gstPct) || 0,
        source: prefill?.enquiryId ? 'WhatsApp' : 'Walk-in',
        ...(prefill?.enquiryId ? { enquiryId: prefill.enquiryId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(Number(advancePaid) > 0 ? { advancePayment: { amount: Number(advancePaid), mode: advanceMode } } : {}),
      };

      const fd = new FormData();
      fd.append('data', JSON.stringify(payload));
      files.forEach((f) => fd.append('files', f));
      const booking = dataOf(await createBooking(fd));

      ['bookings', 'dashboard', 'rooms', 'guests', 'enquiries', 'payments'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success(`Booking ${booking.bookingNo} created`);
      navigate(`/admin/bookings/${booking._id}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create booking';
      const field = err.response?.data?.errors?.[0];
      toast.error(field?.field ? `${msg}: ${field.field} — ${field.message}` : msg);
      // A room was taken meanwhile: refresh the list
      if (err.response?.status === 409) queryClient.invalidateQueries({ queryKey: ['available-rooms'] });
    } finally {
      setSaving(false);
    }
  };

  const handleGuestFormSubmit = handleSubmit((guestData) => {
    setSelectedGuest({ ...guestData, isNew: true });
    setNewGuest(false);
    setStep(1);
  });

  const StepIndicator = () => (
    <ol className="flex items-start mb-8">
      {STEPS.map((s, i) => (
        <li key={s} className={`flex items-start ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
          <button
            type="button"
            onClick={() => i < step && setStep(i)}
            disabled={i >= step}
            className="flex flex-col items-center gap-1.5 group"
          >
            <span
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                i < step ? 'bg-brand-600 text-white group-hover:bg-brand-700'
                : i === step ? 'bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-900/50'
                : 'bg-ink-200 dark:bg-ink-700 text-ink-400'
              }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </span>
            <span className={`text-xs whitespace-nowrap ${i === step ? 'font-semibold text-ink-900 dark:text-white' : 'text-ink-400'}`}>{s}</span>
          </button>
          {i < STEPS.length - 1 && (
            <span className={`flex-1 h-0.5 mt-[18px] mx-2 rounded ${i < step ? 'bg-brand-600' : 'bg-ink-200 dark:bg-ink-700'}`} />
          )}
        </li>
      ))}
    </ol>
  );

  // Live summary shown next to every step
  const Row = ({ label, value, strong, tone }) => (
    <div className={`flex justify-between gap-3 ${strong ? 'font-semibold text-ink-900 dark:text-white' : 'text-ink-600 dark:text-ink-300'} ${tone || ''}`}>
      <span>{label}</span><span className="text-right">{value}</span>
    </div>
  );
  const Summary = () => (
    <div className="card lg:sticky lg:top-4 space-y-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Booking summary</p>
        <p className="font-semibold text-ink-900 dark:text-white mt-1">{hotel?.name || 'Hotel'}</p>
      </div>
      <div className="space-y-1.5">
        <Row label="Guest" value={selectedGuest?.name || '—'} />
        {selectedGuest?.phone && <Row label="Phone" value={selectedGuest.phone} />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-ink-50 dark:bg-ink-700/40 p-2.5">
          <p className="text-[11px] uppercase text-ink-400">Check-in</p>
          <p className="font-medium text-ink-900 dark:text-white">{ciDate ? dayjs(checkIn).format('DD MMM') : '—'}</p>
          <p className="text-xs text-ink-500">{ciDate ? formatClock(ciTime ?? hotelCheckIn) : ''}</p>
        </div>
        <div className="rounded-lg bg-ink-50 dark:bg-ink-700/40 p-2.5">
          <p className="text-[11px] uppercase text-ink-400">Check-out</p>
          <p className="font-medium text-ink-900 dark:text-white">{coDate ? dayjs(checkOut).format('DD MMM') : '—'}</p>
          <p className="text-xs text-ink-500">{coDate ? formatClock(coTime ?? hotelCheckOut) : ''}</p>
        </div>
      </div>
      {nights > 0 && <p className="text-center text-xs font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 rounded-lg py-1.5">{nights} night{nights !== 1 ? 's' : ''}</p>}
      {selectedRooms.length > 0 && (
        <div className="space-y-1.5 border-t border-ink-100 dark:border-ink-700 pt-3">
          {selectedRooms.map((r) => (
            <Row
              key={roomId(r)}
              label={<span>Room {r.roomNumber} <span className="text-xs text-ink-400">({modeOf(r)})</span></span>}
              value={`${formatINR(overrideRates[roomId(r)] ?? priceOf(r))} × ${nights || 0}`}
            />
          ))}
        </div>
      )}
      <div className="space-y-1.5 border-t border-ink-100 dark:border-ink-700 pt-3">
        <Row label="Room total" value={formatINR(roomTotal)} />
        {Number(extraCharges) > 0 && <Row label={extraLabel || 'Extra charges'} value={`+ ${formatINR(extraCharges)}`} />}
        {Number(discount) > 0 && <Row label="Discount" value={`− ${formatINR(discount)}`} tone="!text-emerald-600" />}
        {Number(gstPct) > 0 && <Row label={`GST (${gstPct}%)`} value={`+ ${formatINR(gstAmt)}`} />}
        <div className="flex justify-between text-base font-bold text-ink-900 dark:text-white pt-1">
          <span>Grand total</span><span className="text-brand-600 dark:text-brand-400">{formatINR(grandTotal)}</span>
        </div>
        {Number(advancePaid) > 0 && <Row label={`Advance (${advanceMode})`} value={`− ${formatINR(advancePaid)}`} />}
        <Row label="Balance due" value={formatINR(balance)} strong tone={balance > 0 ? '!text-red-500' : '!text-emerald-600'} />
      </div>
      {files.length > 0 && <p className="text-xs text-ink-500">📎 {files.length} document(s) attached</p>}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/bookings')} className="btn-ghost p-2"><ChevronLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="page-title">New Booking</h1>
            <p className="text-sm text-ink-500 dark:text-ink-400">{hotel?.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
      <div className="card shadow-sm">
        <StepIndicator />

        {/* Step 0: Guest */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-ink-900 dark:text-white text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-brand-500" /> Guest Details
            </h2>

            {/* Search existing */}
            <div>
              <label className="label">Search existing guest by phone</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                <input
                  className="input pl-9"
                  placeholder="Enter phone number…"
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                />
              </div>
              {guestResults.length > 0 && (
                <div className="mt-2 border border-ink-200 dark:border-ink-700 rounded-lg overflow-hidden">
                  {guestResults.map((g) => (
                    <button
                      key={g._id || g.id}
                      onClick={() => { setSelectedGuest(g); setGuestSearch(''); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-700 text-left transition-colors border-b border-ink-100 dark:border-ink-700 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 font-bold text-sm">
                        {g.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-ink-900 dark:text-white text-sm">{g.name}</p>
                        <p className="text-xs text-ink-400">{g.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected guest */}
            {selectedGuest && (
              <div className="flex items-center gap-3 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-200 dark:border-brand-800">
                <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold">
                  {selectedGuest.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-ink-900 dark:text-white">{selectedGuest.name}</p>
                  <p className="text-sm text-ink-500">
                    {[selectedGuest.phone, selectedGuest.email].filter(Boolean).join(' · ')}
                    {selectedGuest.isNew && <span className="badge-blue ml-2">New guest</span>}
                  </p>
                </div>
                <button onClick={() => setSelectedGuest(null)} className="text-ink-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* Number of people staying */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="party-adults">Adults *</label>
                <input id="party-adults" type="number" className="input" min={1} max={100} value={party.adults}
                  onChange={(e) => setParty((p) => ({ ...p, adults: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="party-children">Children</label>
                <input id="party-children" type="number" className="input" min={0} max={100} value={party.children}
                  onChange={(e) => setParty((p) => ({ ...p, children: e.target.value }))} />
              </div>
            </div>

            {/* New guest toggle */}
            {!selectedGuest && (
              <button
                type="button"
                onClick={() => setNewGuest(!newGuest)}
                className="btn-secondary w-full justify-center"
              >
                <Plus className="w-4 h-4" /> {newGuest ? 'Cancel New Guest' : 'Add New Guest'}
              </button>
            )}

            {/* New guest form */}
            {newGuest && (
              <form onSubmit={handleGuestFormSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-ink-200 dark:border-ink-700 rounded-xl p-4">
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
                <div>
                  <label className="label">Email</label>
                  <input type="email" {...register('email')} className="input" />
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
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setNewGuest(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Use This Guest</button>
                </div>
              </form>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  if (!selectedGuest) { toast.error('Select or create a guest first'); return; }
                  setStep(1);
                }}
                disabled={!selectedGuest}
                className="btn-primary"
              >
                Next: Stay Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Stay */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-ink-900 dark:text-white text-lg flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-brand-500" /> Stay Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Check-in *</label>
                <div className="flex gap-2">
                  <input type="date" className="input flex-1" value={ciDate} onChange={(e) => changeCheckInDate(e.target.value)} />
                  <input type="time" className="input w-32" value={ciTime ?? hotelCheckIn} onChange={(e) => setCiTime(e.target.value || null)} />
                </div>
                <p className="text-xs text-ink-400 mt-1">
                  Hotel check-in time {formatClock(hotelCheckIn)}
                  {ciTime && ciTime !== hotelCheckIn && (
                    <> · <button type="button" onClick={() => setCiTime(null)} className="text-brand-600 hover:underline">use default</button></>
                  )}
                </p>
              </div>
              <div>
                <label className="label">Check-out *</label>
                <div className="flex gap-2">
                  <input type="date" className="input flex-1" value={coDate} min={ciDate || undefined} onChange={(e) => setCoDate(e.target.value)} />
                  <input type="time" className="input w-32" value={coTime ?? hotelCheckOut} onChange={(e) => setCoTime(e.target.value || null)} />
                </div>
                <p className="text-xs text-ink-400 mt-1">
                  Hotel check-out time {formatClock(hotelCheckOut)}
                  {coTime && coTime !== hotelCheckOut && (
                    <> · <button type="button" onClick={() => setCoTime(null)} className="text-brand-600 hover:underline">use default</button></>
                  )}
                </p>
              </div>
            </div>
            {nights > 0 && (
              <div className="px-4 py-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg text-sm text-brand-700 dark:text-brand-300 font-medium">
                {nights} night{nights !== 1 ? 's' : ''}
              </div>
            )}

            <div>
              <label className="label">Book rooms as</label>
              <ModeToggle value={defaultMode} onChange={setDefaultMode} />
              <p className="text-xs text-ink-400 mt-1">Every room can be AC or Non-AC. You can change it per room below.</p>
            </div>

            {checkIn && checkOut && (
              <div>
                <label className="label">Available Rooms (select one or more)</label>
                {availableRooms.length === 0 ? (
                  <p className="text-sm text-ink-400 italic py-4 text-center">No rooms available for the selected dates</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
                    {availableRooms.map((room) => {
                      const id = room._id || room.id;
                      const selected = selectedRooms.some((r) => (r._id || r.id) === id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleRoom(room)}
                          className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                            selected
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm'
                              : 'border-ink-200 dark:border-ink-700 hover:border-brand-300 hover:bg-ink-50 dark:hover:bg-ink-700/30'
                          }`}
                        >
                          {selected && (
                            <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                          <p className="text-lg font-bold text-ink-900 dark:text-white leading-none">{room.roomNumber}</p>
                          <p className="text-[11px] text-ink-400 mt-1 truncate">
                            {[room.floor && `Floor ${room.floor}`, room.bedType, room.maxGuests && `${room.maxGuests} guests`].filter(Boolean).join(' · ') || 'Room'}
                          </p>
                          <div className="mt-2 space-y-0.5">
                            {['AC', 'Non-AC'].map((m) => {
                              const active = (selected ? modeOf(room) : defaultMode) === m;
                              return (
                                <p key={m} className={`flex justify-between text-xs rounded px-1.5 py-0.5 ${active ? 'bg-brand-600 text-white font-semibold' : 'text-ink-500'}`}>
                                  <span>{m}</span><span>{formatINR(m === 'AC' ? room.acPrice : room.nonAcPrice)}</span>
                                </p>
                              );
                            })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedRooms.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {selectedRooms.map((room) => (
                      <div key={roomId(room)} className="flex items-center gap-3 p-2.5 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
                        <span className="text-sm font-medium text-ink-700 dark:text-ink-200 flex-1">Room {room.roomNumber}</span>
                        <ModeToggle value={modeOf(room)} onChange={(m) => setMode(room, m)} small />
                        <span className="text-sm font-semibold text-brand-700 dark:text-brand-300 w-24 text-right">{formatINR(priceOf(room))}/night</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(0)} className="btn-secondary"><ChevronLeft className="w-4 h-4" /> Back</button>
              <button
                onClick={() => {
                  if (!checkIn || !checkOut) { toast.error('Select check-in and check-out'); return; }
                  if (checkOut <= checkIn) { toast.error('Check-out must be after check-in'); return; }
                  if (selectedRooms.length === 0) { toast.error('Select at least one room'); return; }
                  setStep(2);
                }}
                className="btn-primary"
              >
                Next: Amount <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Amount */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-ink-900 dark:text-white text-lg flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-brand-500" /> Amount Details
            </h2>

            {/* Override rates per room */}
            <div className="space-y-2">
              <label className="label">Room Rates (override if needed)</label>
              {selectedRooms.map((room) => {
                const id = room._id || room.id;
                return (
                  <div key={id} className="flex items-center gap-3 p-3 bg-ink-50 dark:bg-ink-700/50 rounded-lg">
                    <span className="text-sm font-medium text-ink-700 dark:text-ink-300 flex-1">
                      Room {room.roomNumber}
                    </span>
                    <ModeToggle value={modeOf(room)} onChange={(m) => setMode(room, m)} small />
                    <input
                      type="number"
                      className="input w-32 text-right"
                      value={overrideRates[id] ?? priceOf(room)}
                      onChange={(e) => setOverrideRates((prev) => ({ ...prev, [id]: Number(e.target.value) }))}
                      min={0}
                    />
                    <span className="text-xs text-ink-400">/night</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Extra Charges (₹)</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={extraLabel} onChange={(e) => setExtraLabel(e.target.value)} placeholder="Label" />
                  <input type="number" className="input w-28" value={extraCharges} onChange={(e) => setExtraCharges(e.target.value)} min={0} />
                </div>
              </div>
              <div>
                <label className="label">Discount (₹)</label>
                <input type="number" className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} min={0} />
              </div>
              <div>
                <label className="label">GST (%)</label>
                <input type="number" className="input" value={gstPct} onChange={(e) => setGstPct(e.target.value)} min={0} max={100} />
              </div>
              <div>
                <label className="label">Advance Paid (₹)</label>
                <div className="flex gap-2">
                  <input type="number" className="input flex-1" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} min={0} />
                  <select className="input w-28" value={advanceMode} onChange={(e) => setAdvanceMode(e.target.value)} disabled={!Number(advancePaid)}>
                    {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Notes</label>
                <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-ink-50 dark:bg-ink-700/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-ink-600 dark:text-ink-300">
                <span>Room Total ({nights} nights)</span>
                <span>{formatINR(roomTotal)}</span>
              </div>
              {Number(extraCharges) > 0 && (
                <div className="flex justify-between text-ink-600 dark:text-ink-300">
                  <span>{extraLabel || 'Extra charges'}</span>
                  <span>+ {formatINR(extraCharges)}</span>
                </div>
              )}
              {Number(discount) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span>- {formatINR(discount)}</span>
                </div>
              )}
              {Number(gstPct) > 0 && (
                <div className="flex justify-between text-ink-600 dark:text-ink-300">
                  <span>GST ({gstPct}%)</span>
                  <span>+ {formatINR(gstAmt)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-ink-900 dark:text-white border-t border-ink-200 dark:border-ink-600 pt-2 mt-2">
                <span>Grand Total</span>
                <span className="text-brand-600 dark:text-brand-400">{formatINR(grandTotal)}</span>
              </div>
              {Number(advancePaid) > 0 && (
                <div className="flex justify-between text-ink-600 dark:text-ink-300">
                  <span>Advance Paid</span>
                  <span>- {formatINR(advancePaid)}</span>
                </div>
              )}
              <div className={`flex justify-between font-bold text-base ${balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                <span>Balance Due</span>
                <span>{formatINR(balance)}</span>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="btn-secondary"><ChevronLeft className="w-4 h-4" /> Back</button>
              <button onClick={() => setStep(3)} className="btn-primary">
                Next: Documents <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-semibold text-ink-900 dark:text-white text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-500" /> Documents (Optional)
            </h2>
            <FileUpload onFiles={setFiles} multiple />

            {/* Final summary */}
            <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4 text-sm space-y-1">
              <p className="font-semibold text-brand-800 dark:text-brand-300 mb-2">Booking Summary</p>
              <p className="text-ink-600 dark:text-ink-300">Guest: <strong>{selectedGuest?.name}</strong></p>
              <p className="text-ink-600 dark:text-ink-300">Rooms: <strong>{selectedRooms.map((r) => `Room ${r.roomNumber} (${modeOf(r)})`).join(', ')}</strong></p>
              <p className="text-ink-600 dark:text-ink-300">Nights: <strong>{nights}</strong></p>
              <p className="text-ink-600 dark:text-ink-300">Grand Total: <strong className="text-brand-600 dark:text-brand-400">{formatINR(grandTotal)}</strong></p>
              <p className="text-ink-600 dark:text-ink-300">Balance: <strong className={balance > 0 ? 'text-red-500' : 'text-emerald-500'}>{formatINR(balance)}</strong></p>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="btn-secondary"><ChevronLeft className="w-4 h-4" /> Back</button>
              <button onClick={handleSubmitBooking} disabled={saving} className="btn-primary">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
                ) : (
                  <><Check className="w-4 h-4" /> Confirm Booking</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <aside>
        <Summary />
      </aside>
      </div>
    </div>
  );
}
