import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Users, BedDouble, UserRound, CreditCard, ChevronLeft, ChevronRight, Minus, Plus, Snowflake, Fan,
  AlertTriangle, Upload, FileText, X, Check, Info, MessageCircle, Building2, MapPin, RefreshCw, ShieldCheck,
} from 'lucide-react';
import {
  API_ORIGIN, dataOf, listOf, getPublicHotel, getPublicHotels, getPublicConfig, getPublicAvailability, getPublicQuote,
  createPublicBooking,
} from '../../api/services';
import PublicShell, { PublicCard, FullPageSpinner } from '../../components/booking/PublicShell';
import { fullAddress, waLink } from '../../components/landing/siteUtils';
import { formatINR } from '../../utils/currency';
import { dayjs, TZ, formatDateTime, formatClock } from '../../utils/date';
import { aadhaarDigits, formatAadhaar, isValidAadhaar } from '../../utils/aadhaar';
import { watchAvailability } from '../../utils/publicSocket';

const STEPS = [
  { label: 'Stay', icon: CalendarDays },
  { label: 'Rooms', icon: BedDouble },
  { label: 'Guest details', icon: UserRound },
  { label: 'Review & Pay', icon: CreditCard },
];
const TYPES = ['AC', 'Non-AC'];
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const CONSENT_TEXT = 'I agree that the hotel may store my Aadhaar details for guest verification as required by law.';

const todayIST = () => dayjs().tz(TZ).format('YYYY-MM-DD');
const addDays = (date, n) => dayjs.tz(date, TZ).add(n, 'day').format('YYYY-MM-DD');
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const toInt = (v, min, max, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const apiError = (err) => err?.response?.data?.message || (err?.response ? 'Something went wrong. Please try again.' : 'Could not reach the hotel. Check your internet connection.');
const isRoomsTaken = (err) => err?.response?.status === 409 && err.response.data?.errors?.[0]?.code === 'ROOMS_TAKEN';

const field = 'site-field [color-scheme:light]';

// ------------------------------------------------------------------ small pieces

function Stepper({ step }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2 mb-6" aria-label="Booking steps">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={s.label} className="flex-1 flex items-center gap-1 sm:gap-2 min-w-0" aria-current={current ? 'step' : undefined}>
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 border-2 ${
                done ? 'bg-gold border-gold text-night' : current ? 'border-gold text-ink bg-white' : 'border-cream-100 text-ink-soft bg-white'
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : n}
            </span>
            <span className={`text-xs sm:text-sm truncate ${current ? 'font-semibold text-ink' : 'text-ink-soft'} ${current ? '' : 'hidden sm:inline'}`}>{s.label}</span>
            {n < STEPS.length && <span className={`hidden sm:block flex-1 h-px ${done ? 'bg-gold' : 'bg-cream-100'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Notice({ tone = 'warn', children, onClose }) {
  const styles = tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : tone === 'info' ? 'border-cream-100 bg-cream text-ink' : 'border-amber-200 bg-amber-50 text-amber-900';
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div role={tone === 'info' ? 'status' : 'alert'} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm mb-5 ${styles}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="p-0.5 -m-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

const FieldError = ({ children }) => (children ? <p className="text-xs text-red-700 mt-1">{children}</p> : null);

function Counter({ value, onChange, min = 0, max, label }) {
  return (
    <div className="inline-flex items-center rounded-full border border-ink-300 bg-white" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} className="w-10 h-10 flex items-center justify-center rounded-full text-ink disabled:opacity-30" aria-label={`Fewer ${label}`}>
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-8 text-center font-semibold text-ink" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={max != null && value >= max} className="w-10 h-10 flex items-center justify-center rounded-full text-ink disabled:opacity-30" aria-label={`More ${label}`}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel = 'Continue', nextDisabled, busy, nextIcon: NextIcon = ChevronRight }) {
  return (
    <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
      {onBack ? (
        <button type="button" onClick={onBack} className="btn-outline-ink" disabled={busy}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      ) : <span />}
      <button type="button" onClick={onNext} disabled={nextDisabled || busy} className="btn-gold sm:min-w-[12rem]">
        {busy ? <span className="w-4 h-4 border-2 border-night/30 border-t-night rounded-full animate-spin" /> : null}
        {nextLabel} {!busy && <NextIcon className="w-4 h-4" />}
      </button>
    </div>
  );
}

/** Aadhaar front/back picker with image preview. */
function AadhaarFile({ label, file, onChange, maxMb, error }) {
  const [preview, setPreview] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!FILE_TYPES.includes(f.type)) return onChange(null, 'Use a JPG, PNG, WEBP or PDF file');
    if (f.size > maxMb * 1024 * 1024) return onChange(null, `File is larger than ${maxMb} MB`);
    onChange(f, '');
  };

  return (
    <div>
      <span className="site-label">{label}</span>
      {file ? (
        <div className="relative rounded-2xl border border-ink-300 bg-cream overflow-hidden">
          {preview ? (
            <img src={preview} alt={`${label} preview`} className="w-full h-36 object-contain bg-white" />
          ) : (
            <div className="h-36 flex flex-col items-center justify-center text-ink-soft gap-2">
              <FileText className="w-8 h-8" /> <span className="text-xs">PDF</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-cream-100 bg-white">
            <span className="flex-1 text-xs text-ink truncate">{file.name}</span>
            <button type="button" onClick={() => onChange(null, '')} className="text-xs font-semibold text-red-700 hover:underline">Remove</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full h-[11.5rem] rounded-2xl border-2 border-dashed ${error ? 'border-red-400' : 'border-ink-300'} bg-white hover:border-gold hover:bg-cream transition-colors flex flex-col items-center justify-center gap-2 text-ink-soft`}
        >
          <Upload className="w-7 h-7 text-gold-600" />
          <span className="text-sm font-medium text-ink">Upload {label.toLowerCase()}</span>
          <span className="text-xs">JPG, PNG, WEBP or PDF · up to {maxMb} MB</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={FILE_TYPES.join(',')} onChange={pick} className="sr-only" tabIndex={-1} aria-label={label} />
      <FieldError>{error}</FieldError>
    </div>
  );
}

// ------------------------------------------------------------------ hotel picker (/book)

function HotelPicker() {
  const { search } = useLocation();
  const { data: hotels = [], isLoading } = useQuery({ queryKey: ['public-hotels'], queryFn: () => getPublicHotels().then(listOf) });
  if (isLoading) return <FullPageSpinner />;
  const bookable = hotels.filter((h) => h.onlineBookingEnabled !== false);
  if (bookable.length === 1) return <Navigate to={`/book/${bookable[0].slug}${search}`} replace />;

  return (
    <PublicShell title="Book your stay">
      <h1 className="font-display text-3xl sm:text-4xl text-ink">Choose a hotel</h1>
      <p className="text-ink-soft mt-2 mb-6">Pick where you'd like to stay. Your booking is confirmed instantly.</p>
      {hotels.length === 0 ? (
        <PublicCard><p className="text-ink-soft">No hotels are taking bookings right now.</p></PublicCard>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {hotels.map((h) => {
            const online = h.onlineBookingEnabled !== false;
            const cover = h.coverUrl ? `${API_ORIGIN}${h.coverUrl}` : null;
            return (
              <PublicCard key={h.slug} className="!p-0 overflow-hidden flex flex-col">
                <div className="h-40 bg-gradient-to-br from-night-700 to-night relative">
                  {cover ? <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" /> : (
                    <Building2 className="w-10 h-10 text-gold-300/70 absolute inset-0 m-auto" />
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <p className="font-display text-xl text-ink">{h.name}</p>
                  {(h.area || h.city) && <p className="text-sm text-ink-soft flex items-center gap-1.5 mt-1"><MapPin className="w-3.5 h-3.5" />{[h.area, h.city].filter(Boolean).join(', ')}</p>}
                  {h.startingPrice != null && <p className="text-sm text-ink-soft mt-2">From <span className="font-semibold text-ink">{formatINR(h.startingPrice)}</span> / night</p>}
                  <div className="mt-auto pt-5">
                    {online ? (
                      <Link to={`/book/${h.slug}${search}`} className="btn-gold w-full"><CalendarDays className="w-4 h-4" /> Book this hotel</Link>
                    ) : h.whatsappNumber ? (
                      <a href={waLink(h.whatsappNumber, `Hi, I'd like to book a room at ${h.name}.`)} target="_blank" rel="noopener noreferrer" className="btn-outline-ink w-full">
                        <MessageCircle className="w-4 h-4" /> Enquire on WhatsApp
                      </a>
                    ) : <p className="text-sm text-ink-soft">Please contact the hotel to book.</p>}
                  </div>
                </div>
              </PublicCard>
            );
          })}
        </div>
      )}
    </PublicShell>
  );
}

// ------------------------------------------------------------------ booking stepper (/book/:slug)

function BookingFlow({ slug }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();

  const { data: hotel, isLoading, isError } = useQuery({ queryKey: ['public-hotel', slug], queryFn: () => getPublicHotel(slug).then(dataOf), retry: false });
  const { data: config } = useQuery({ queryKey: ['public-config'], queryFn: () => getPublicConfig().then(dataOf), staleTime: 5 * 60_000 });
  const maxMb = config?.maxUploadMb || 10;

  // ---- step 1 state (pre-filled from the landing page search)
  const [step, setStep] = useState(1);
  const [stay, setStay] = useState(() => {
    const today = todayIST();
    const inDate = isDate(params.get('checkIn')) && params.get('checkIn') >= today ? params.get('checkIn') : today;
    const outParam = params.get('checkOut');
    return {
      inDate,
      inTime: '',
      outDate: isDate(outParam) && outParam > inDate ? outParam : addDays(inDate, 1),
      outTime: '',
      adults: toInt(params.get('adults'), 1, 50, 2),
      children: toInt(params.get('children'), 0, 50, 0),
    };
  });
  const [selection, setSelection] = useState(() => {
    const type = TYPES.includes(params.get('roomType')) ? params.get('roomType') : null;
    const rooms = toInt(params.get('rooms'), 1, 20, 1);
    return { AC: type === 'AC' ? rooms : 0, 'Non-AC': type === 'Non-AC' ? rooms : 0 };
  });
  const [guest, setGuest] = useState({ name: '', phone: '', email: '', address: '' });
  const [aadhaar, setAadhaar] = useState('');
  const [files, setFiles] = useState({ front: null, back: null });
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null); // { tone, text }
  const [searched, setSearched] = useState(null); // stay sent to the server
  const submitting = useRef(false);

  // Default times come from the hotel
  useEffect(() => {
    if (!hotel) return;
    setStay((s) => ({ ...s, inTime: s.inTime || hotel.checkInTime || '12:00', outTime: s.outTime || hotel.checkOutTime || '11:00' }));
  }, [hotel]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const stayParams = searched && {
    checkIn: `${searched.inDate}T${searched.inTime}`,
    checkOut: `${searched.outDate}T${searched.outTime}`,
    adults: searched.adults,
    children: searched.children,
  };

  // ---- availability: live (socket) + every 30 seconds
  const availability = useQuery({
    queryKey: ['public-availability', slug, stayParams],
    queryFn: () => getPublicAvailability(slug, stayParams).then(dataOf),
    enabled: !!stayParams && step >= 2,
    refetchInterval: step >= 2 && step < 4 ? 30_000 : false,
    retry: false,
  });
  const avail = availability.data;

  useEffect(() => {
    if (!hotel?._id) return undefined;
    return watchAvailability(hotel._id, () => {
      queryClient.invalidateQueries({ queryKey: ['public-availability', slug] });
    });
  }, [hotel?._id, slug, queryClient]);

  const chosen = selection.AC + selection['Non-AC'];

  // If rooms were taken meanwhile, trim the selection and say so
  useEffect(() => {
    if (!avail || step < 2) return;
    if (chosen > avail.totalAvailable) {
      setSelection((sel) => {
        const next = { ...sel };
        let excess = next.AC + next['Non-AC'] - avail.totalAvailable;
        for (const t of ['Non-AC', 'AC']) {
          const cut = Math.min(next[t], excess);
          next[t] -= cut;
          excess -= cut;
        }
        return next;
      });
      setNotice({
        tone: 'warn',
        text: avail.totalAvailable
          ? `Some rooms were just booked by someone else. Only ${avail.totalAvailable} room${avail.totalAvailable === 1 ? ' is' : 's are'} left for your dates, so your selection was updated. Please check it again.`
          : 'The rooms for your dates were just booked by someone else. Please choose other dates.',
      });
      if (step > 2) setStep(2);
    }
  }, [avail, chosen, step]);

  // ---- quote for step 4 (server prices only)
  const roomsPayload = TYPES.filter((t) => selection[t] > 0).map((t) => ({ type: t, quantity: selection[t] }));
  const quote = useQuery({
    queryKey: ['public-quote', slug, stayParams, roomsPayload],
    queryFn: () => getPublicQuote(slug, { ...stayParams, rooms: roomsPayload }).then(dataOf),
    enabled: step === 4 && !!stayParams && roomsPayload.length > 0,
    retry: false,
  });

  useEffect(() => {
    if (!quote.error) return;
    if (quote.error.response?.status === 409 || quote.error.response?.status === 400) {
      setNotice({ tone: 'warn', text: apiError(quote.error) });
      setStep(2);
      queryClient.invalidateQueries({ queryKey: ['public-availability', slug] });
    }
  }, [quote.error, slug, queryClient]);

  // ---- submit
  const book = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        ...stayParams,
        rooms: roomsPayload,
        guest: { ...guest, phone: guest.phone.replace(/\D/g, '') },
        aadhaar: aadhaarDigits(aadhaar),
        consent,
        website,
      }));
      [files.front, files.back].filter(Boolean).forEach((f) => fd.append('aadhaarFiles', f));
      return createPublicBooking(slug, fd).then(dataOf);
    },
    onSuccess: (data) => {
      const result = { ...data, paymentEnabled: !!config?.paymentEnabled, bookedAt: new Date().toISOString() };
      try { sessionStorage.setItem('kkm:lastOnlineBooking', JSON.stringify(result)); } catch { /* private mode */ }
      navigate('/booking-confirmed', { replace: true, state: { booking: result } });
    },
    onError: (err) => {
      submitting.current = false;
      const res = err.response;
      if (isRoomsTaken(err)) {
        setNotice({ tone: 'warn', text: `${apiError(err)} Your details are kept, so you only need to pick rooms again.` });
        queryClient.invalidateQueries({ queryKey: ['public-availability', slug] });
        setStep(2);
        return;
      }
      if (res?.status === 400 && res.data?.errors?.length) {
        const fieldErrors = {};
        res.data.errors.forEach((e) => {
          const key = (e.field || '').replace(/^guest\./, '');
          if (key) fieldErrors[key] = e.message;
        });
        const guestFields = ['name', 'phone', 'email', 'address', 'aadhaar', 'aadhaarFiles', 'consent'];
        if (Object.keys(fieldErrors).some((k) => guestFields.includes(k))) {
          setErrors(fieldErrors);
          setNotice({ tone: 'error', text: 'Please check the highlighted details.' });
          setStep(3);
          return;
        }
      }
      setNotice({ tone: 'error', text: apiError(err) });
    },
  });

  const payNow = () => {
    if (submitting.current || book.isPending) return; // no double submit
    submitting.current = true;
    setNotice(null);
    book.mutate();
  };

  // ---- step validation
  const goStep2 = () => {
    const e = {};
    const today = todayIST();
    if (!isDate(stay.inDate)) e.inDate = 'Choose a check-in date';
    else if (stay.inDate < today) e.inDate = 'Check-in cannot be in the past';
    if (!isDate(stay.outDate)) e.outDate = 'Choose a check-out date';
    const inAt = dayjs.tz(`${stay.inDate}T${stay.inTime}`, TZ);
    const outAt = dayjs.tz(`${stay.outDate}T${stay.outTime}`, TZ);
    if (!e.inDate && !e.outDate && !outAt.isAfter(inAt)) e.outDate = 'Check-out must be after check-in';
    if (!e.outDate && outAt.isBefore(dayjs())) e.outDate = 'Check-out time has already passed';
    if (!e.outDate && dayjs.tz(stay.outDate, TZ).diff(dayjs.tz(stay.inDate, TZ), 'day') > 30) e.outDate = 'Online bookings are limited to 30 nights';
    if (!stay.inTime) e.inTime = 'Choose a time';
    if (!stay.outTime) e.outTime = 'Choose a time';
    setErrors(e);
    if (Object.keys(e).length) return;
    setNotice(null);
    setSearched({ ...stay });
    setStep(2);
  };

  const goStep3 = () => {
    if (!chosen) return setNotice({ tone: 'warn', text: 'Select at least one room.' });
    setNotice(null);
    setStep(3);
  };

  const goStep4 = () => {
    const e = {};
    if (guest.name.trim().length < 2) e.name = 'Enter your full name';
    const digits = guest.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(digits)) e.phone = 'Enter a valid 10-digit mobile number';
    if (guest.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email)) e.email = 'Enter a valid email or leave it empty';
    if (guest.address.trim().length < 5) e.address = 'Enter your address';
    if (aadhaarDigits(aadhaar).length !== 12) e.aadhaar = 'Aadhaar number must be 12 digits';
    else if (!isValidAadhaar(aadhaar)) e.aadhaar = 'This Aadhaar number is not valid. Please check it.';
    if (hotel.requireAadhaarUpload && !files.front && !files.back) e.aadhaarFiles = 'Upload your Aadhaar card';
    if (!consent) e.consent = 'Please accept to continue';
    setErrors(e);
    if (Object.keys(e).length) {
      setNotice({ tone: 'error', text: 'Please check the highlighted details.' });
      return;
    }
    setGuest((g) => ({ ...g, phone: digits }));
    setNotice(null);
    setStep(4);
  };

  // ---- render
  if (isLoading) return <FullPageSpinner />;
  if (isError || !hotel) {
    return (
      <PublicShell title="Book your stay">
        <PublicCard className="text-center">
          <p className="font-display text-2xl text-ink">Hotel not found</p>
          <p className="text-ink-soft mt-2">This hotel doesn't exist or isn't taking bookings.</p>
          <Link to="/" className="btn-gold mt-6"><ChevronLeft className="w-4 h-4" /> Back to home</Link>
        </PublicCard>
      </PublicShell>
    );
  }
  if (hotel.onlineBookingEnabled === false) {
    return (
      <PublicShell title={hotel.name} backTo={`/hotel/${hotel.slug}`} backLabel="Hotel page">
        <PublicCard className="text-center">
          <p className="font-display text-2xl text-ink">Online booking is not available</p>
          <p className="text-ink-soft mt-2">Please contact {hotel.name} to book your room.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {hotel.whatsappNumber && (
              <a href={waLink(hotel.whatsappNumber, `Hi, I'd like to book a room at ${hotel.name}.`)} target="_blank" rel="noopener noreferrer" className="btn-gold">
                <MessageCircle className="w-4 h-4" /> WhatsApp the hotel
              </a>
            )}
            <Link to={`/hotel/${hotel.slug}`} className="btn-outline-ink">View hotel</Link>
          </div>
        </PublicCard>
      </PublicShell>
    );
  }

  const set = (setter, key) => (e) => { setter((s) => ({ ...s, [key]: e.target.value })); setErrors((x) => ({ ...x, [key]: undefined })); };
  const nightsPreview = Math.max(1, dayjs.tz(stay.outDate, TZ).diff(dayjs.tz(stay.inDate, TZ), 'day') || 1);
  const guests = (searched?.adults || stay.adults) + (searched?.children || stay.children);

  return (
    <PublicShell title={hotel.name} backTo={`/hotel/${hotel.slug}`} backLabel="Hotel page">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-[0.25em] uppercase text-gold-600">Book online · Instant confirmation</p>
        <h1 className="font-display text-3xl sm:text-4xl text-ink mt-2">{hotel.name}</h1>
        {fullAddress(hotel) && <p className="text-sm text-ink-soft mt-1 flex items-center gap-1.5"><MapPin className="w-4 h-4 flex-shrink-0" />{fullAddress(hotel)}</p>}
      </div>

      <Stepper step={step} />
      {notice && <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice>}

      {/* ------------------------------------------------------------ Step 1: Stay */}
      {step === 1 && (
        <PublicCard>
          <h2 className="font-display text-2xl text-ink mb-5">When are you staying?</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <fieldset className="rounded-2xl bg-cream p-4">
              <legend className="sr-only">Check-in</legend>
              <p className="font-semibold text-ink mb-3">Check-in</p>
              <div className="grid grid-cols-[1.4fr_1fr] gap-3">
                <label>
                  <span className="site-label">Date</span>
                  <input type="date" className={field} min={todayIST()} value={stay.inDate} onChange={(e) => {
                    const v = e.target.value;
                    setStay((s) => ({ ...s, inDate: v, outDate: s.outDate <= v ? addDays(v, 1) : s.outDate }));
                    setErrors((x) => ({ ...x, inDate: undefined, outDate: undefined }));
                  }} />
                  <FieldError>{errors.inDate}</FieldError>
                </label>
                <label>
                  <span className="site-label">Time</span>
                  <input type="time" className={field} value={stay.inTime} onChange={set(setStay, 'inTime')} />
                  <FieldError>{errors.inTime}</FieldError>
                </label>
              </div>
            </fieldset>
            <fieldset className="rounded-2xl bg-cream p-4">
              <legend className="sr-only">Check-out</legend>
              <p className="font-semibold text-ink mb-3">Check-out</p>
              <div className="grid grid-cols-[1.4fr_1fr] gap-3">
                <label>
                  <span className="site-label">Date</span>
                  <input type="date" className={field} min={addDays(stay.inDate || todayIST(), 0)} value={stay.outDate} onChange={set(setStay, 'outDate')} />
                  <FieldError>{errors.outDate}</FieldError>
                </label>
                <label>
                  <span className="site-label">Time</span>
                  <input type="time" className={field} value={stay.outTime} onChange={set(setStay, 'outTime')} />
                  <FieldError>{errors.outTime}</FieldError>
                </label>
              </div>
            </fieldset>
          </div>
          <p className="text-xs text-ink-soft mt-3">
            Usual check-in {formatClock(hotel.checkInTime)} · check-out {formatClock(hotel.checkOutTime)} · {nightsPreview} night{nightsPreview === 1 ? '' : 's'}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-cream-100 p-4">
              <div>
                <p className="font-semibold text-ink flex items-center gap-2"><Users className="w-4 h-4 text-gold-600" /> Adults</p>
                <p className="text-xs text-ink-soft">Age 12 and above</p>
              </div>
              <Counter label="adults" value={stay.adults} min={1} max={50} onChange={(v) => setStay((s) => ({ ...s, adults: v }))} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-cream-100 p-4">
              <div>
                <p className="font-semibold text-ink">Children</p>
                <p className="text-xs text-ink-soft">Below 12</p>
              </div>
              <Counter label="children" value={stay.children} min={0} max={50} onChange={(v) => setStay((s) => ({ ...s, children: v }))} />
            </div>
          </div>
          <NavButtons onNext={goStep2} nextLabel="See available rooms" />
        </PublicCard>
      )}

      {/* ------------------------------------------------------------ Step 2: Rooms */}
      {step === 2 && (
        <div className="space-y-5">
          <PublicCard className="!py-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-ink"><span className="text-ink-soft">Check-in</span> {formatDateTime(stayParams.checkIn)}</span>
            <span className="text-ink"><span className="text-ink-soft">Check-out</span> {formatDateTime(stayParams.checkOut)}</span>
            <span className="text-ink">{guests} guest{guests === 1 ? '' : 's'}</span>
            <button type="button" onClick={() => setStep(1)} className="ml-auto text-gold-600 font-semibold hover:underline">Change</button>
          </PublicCard>

          {availability.isLoading ? (
            <PublicCard className="flex items-center gap-3 text-ink-soft">
              <span className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" /> Checking free rooms…
            </PublicCard>
          ) : availability.isError ? (
            <PublicCard>
              <p className="text-ink">{apiError(availability.error)}</p>
              <button type="button" onClick={() => setStep(1)} className="btn-outline-ink mt-4"><ChevronLeft className="w-4 h-4" /> Change dates</button>
            </PublicCard>
          ) : !avail?.totalAvailable ? (
            <PublicCard className="text-center">
              <BedDouble className="w-10 h-10 text-gold-600 mx-auto" />
              <p className="font-display text-2xl text-ink mt-3">No rooms free for these dates</p>
              <p className="text-ink-soft mt-2">Please try other dates{hotel.whatsappNumber ? ' or message the hotel' : ''}.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-gold"><CalendarDays className="w-4 h-4" /> Change dates</button>
                {hotel.whatsappNumber && (
                  <a href={waLink(hotel.whatsappNumber, `Hi, are rooms available at ${hotel.name} from ${formatDateTime(stayParams.checkIn)} to ${formatDateTime(stayParams.checkOut)}?`)} target="_blank" rel="noopener noreferrer" className="btn-outline-ink">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </a>
                )}
              </div>
            </PublicCard>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-sm">
                <p className="text-ink">
                  <span className="font-semibold">{avail.totalAvailable} room{avail.totalAvailable === 1 ? '' : 's'} left</span>
                  <span className="text-ink-soft"> · every room can be taken as AC or Non-AC</span>
                </p>
                <button type="button" onClick={() => availability.refetch()} className="inline-flex items-center gap-1 text-ink-soft hover:text-ink" aria-label="Refresh availability">
                  <RefreshCw className={`w-4 h-4 ${availability.isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {!avail.enoughCapacity && (
                <Notice>The free rooms can't hold {guests} guests together. Please reduce guests or contact the hotel.</Notice>
              )}
              {avail.roomTypes.map((rt) => {
                const photo = rt.photos?.[0] ? `${API_ORIGIN}${rt.photos[0]}` : null;
                const qty = selection[rt.type];
                const left = avail.totalAvailable - chosen;
                return (
                  <PublicCard key={rt.type} className={`!p-0 overflow-hidden ${qty > 0 ? 'ring-2 ring-gold' : ''}`}>
                    <div className="grid sm:grid-cols-[14rem_1fr]">
                      <div className="h-40 sm:h-full min-h-[10rem] bg-gradient-to-br from-night-700 to-night relative">
                        {photo ? <img src={photo} alt={`${rt.type} room`} loading="lazy" className="absolute inset-0 w-full h-full object-cover" /> : (
                          <BedDouble className="w-10 h-10 text-gold-300/70 absolute inset-0 m-auto" />
                        )}
                        {rt.photos?.length > 1 && (
                          <span className="absolute bottom-2 right-2 rounded-full bg-night/80 text-white text-[11px] px-2 py-0.5">+{rt.photos.length - 1} photos</span>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-2xl text-ink flex items-center gap-2">
                              {rt.type === 'AC' ? <Snowflake className="w-5 h-5 text-gold-600" /> : <Fan className="w-5 h-5 text-gold-600" />} {rt.type} room
                            </p>
                            <p className="text-sm text-ink-soft mt-0.5">Up to {rt.maxGuests} guest{rt.maxGuests === 1 ? '' : 's'} per room</p>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-2xl text-ink">
                              {rt.maxPricePerNight > rt.pricePerNight && <span className="text-sm font-sans text-ink-soft">from </span>}
                              {formatINR(rt.pricePerNight)}
                            </p>
                            <p className="text-xs text-ink-soft">per room / night{hotel.gstPercent > 0 ? ` + ${hotel.gstPercent}% GST` : ''}</p>
                          </div>
                        </div>
                        {rt.amenities?.length > 0 && (
                          <ul className="mt-3 flex flex-wrap gap-1.5">
                            {rt.amenities.slice(0, 8).map((a) => (
                              <li key={a} className="rounded-full border border-cream-100 bg-cream px-2.5 py-0.5 text-xs text-ink-soft">{a}</li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <span className={`text-sm font-semibold ${left <= 2 ? 'text-red-700' : 'text-ink'}`}>
                            {rt.availableCount} room{rt.availableCount === 1 ? '' : 's'} left
                          </span>
                          <Counter
                            label={`${rt.type} rooms`}
                            value={qty}
                            min={0}
                            max={Math.min(20, qty + left)}
                            onChange={(v) => { setSelection((s) => ({ ...s, [rt.type]: v })); setNotice(null); }}
                          />
                        </div>
                      </div>
                    </div>
                  </PublicCard>
                );
              })}
              <PublicCard className="!py-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-ink">
                  <span className="font-semibold">{chosen} room{chosen === 1 ? '' : 's'} selected</span>
                  {chosen > 0 && <span className="text-ink-soft"> · {TYPES.filter((t) => selection[t]).map((t) => `${selection[t]} ${t}`).join(' + ')}</span>}
                </p>
                <p className="text-xs text-ink-soft">Room numbers are given to you as soon as you book</p>
              </PublicCard>
            </>
          )}
          <NavButtons onBack={() => setStep(1)} onNext={goStep3} nextDisabled={!chosen || !avail?.totalAvailable} />
        </div>
      )}

      {/* ------------------------------------------------------------ Step 3: Guest details */}
      {step === 3 && (
        <PublicCard>
          <h2 className="font-display text-2xl text-ink mb-5">Your details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="site-label">Full name *</span>
              <input className={field} value={guest.name} onChange={set(setGuest, 'name')} autoComplete="name" maxLength={120} placeholder="As on your Aadhaar" />
              <FieldError>{errors.name}</FieldError>
            </label>
            <label>
              <span className="site-label">Mobile number *</span>
              <input className={field} value={guest.phone} onChange={set(setGuest, 'phone')} inputMode="tel" autoComplete="tel" maxLength={16} placeholder="10-digit mobile" />
              <FieldError>{errors.phone}</FieldError>
            </label>
            <label>
              <span className="site-label">Email (optional)</span>
              <input className={field} type="email" value={guest.email} onChange={set(setGuest, 'email')} autoComplete="email" maxLength={120} placeholder="you@example.com" />
              <FieldError>{errors.email}</FieldError>
            </label>
            <label className="sm:col-span-2">
              <span className="site-label">Address *</span>
              <textarea className={`${field} resize-none`} rows={2} value={guest.address} onChange={set(setGuest, 'address')} autoComplete="street-address" maxLength={500} placeholder="House, street, city, PIN" />
              <FieldError>{errors.address}</FieldError>
            </label>
            <label className="sm:col-span-2">
              <span className="site-label">Aadhaar number *</span>
              <input
                className={`${field} font-mono tracking-wider`}
                value={formatAadhaar(aadhaar)}
                onChange={(e) => { setAadhaar(aadhaarDigits(e.target.value)); setErrors((x) => ({ ...x, aadhaar: undefined })); }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="1234 5678 9012"
                maxLength={14}
              />
              <FieldError>{errors.aadhaar}</FieldError>
            </label>
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <AadhaarFile label="Aadhaar front" file={files.front} maxMb={maxMb} error={errors.aadhaarFiles}
                onChange={(f, msg) => { setFiles((x) => ({ ...x, front: f })); setErrors((x) => ({ ...x, aadhaarFiles: msg || undefined })); }} />
              <AadhaarFile label="Aadhaar back" file={files.back} maxMb={maxMb}
                onChange={(f, msg) => { setFiles((x) => ({ ...x, back: f })); setErrors((x) => ({ ...x, aadhaarFiles: msg || undefined })); }} />
            </div>
            <p className="sm:col-span-2 text-xs text-ink-soft flex items-start gap-1.5 -mt-1">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 text-gold-600" />
              {hotel.requireAadhaarUpload ? 'Upload at least one side (both if they are separate). ' : 'Upload is optional. '}
              Your Aadhaar number is stored encrypted and is only visible to the hotel.
            </p>
            {/* Honeypot: hidden from people, bots fill it */}
            <div aria-hidden="true" className="absolute -left-[10000px] w-px h-px overflow-hidden">
              <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
            </div>
            <label className="sm:col-span-2 flex items-start gap-3 rounded-2xl bg-cream p-4 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrors((x) => ({ ...x, consent: undefined })); }} className="w-5 h-5 mt-0.5 accent-[rgb(var(--gold-600))] flex-shrink-0" />
              <span className="text-sm text-ink">{CONSENT_TEXT}</span>
            </label>
            <FieldError>{errors.consent}</FieldError>
          </div>
          <NavButtons onBack={() => setStep(2)} onNext={goStep4} nextLabel="Review booking" />
        </PublicCard>
      )}

      {/* ------------------------------------------------------------ Step 4: Review & Pay */}
      {step === 4 && (
        <div className="space-y-5">
          <PublicCard>
            <h2 className="font-display text-2xl text-ink mb-4">Review your booking</h2>
            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div><dt className="text-ink-soft">Check-in</dt><dd className="font-semibold text-ink">{formatDateTime(stayParams.checkIn)}</dd></div>
              <div><dt className="text-ink-soft">Check-out</dt><dd className="font-semibold text-ink">{formatDateTime(stayParams.checkOut)}</dd></div>
              <div><dt className="text-ink-soft">Guests</dt><dd className="font-semibold text-ink">{searched.adults} adult{searched.adults === 1 ? '' : 's'}{searched.children ? `, ${searched.children} child${searched.children === 1 ? '' : 'ren'}` : ''}</dd></div>
              <div><dt className="text-ink-soft">Booked by</dt><dd className="font-semibold text-ink">{guest.name} · {guest.phone}</dd></div>
            </dl>

            <div className="mt-6 border-t border-cream-100 pt-5">
              {quote.isLoading ? (
                <p className="flex items-center gap-3 text-ink-soft"><span className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" /> Calculating price…</p>
              ) : quote.data ? (
                <div className="space-y-2 text-sm">
                  {quote.data.lines.map((l) => (
                    <div key={`${l.type}-${l.ratePerNight}`} className="flex justify-between gap-4 text-ink">
                      <span>{l.quantity} × {l.type} room · {formatINR(l.ratePerNight)} × {l.nights} night{l.nights === 1 ? '' : 's'}</span>
                      <span>{formatINR(l.amount)}</span>
                    </div>
                  ))}
                  {quote.data.gstPercent > 0 && (
                    <div className="flex justify-between text-ink-soft"><span>GST ({quote.data.gstPercent}%)</span><span>{formatINR(quote.data.gstAmount)}</span></div>
                  )}
                  <div className="flex justify-between items-baseline border-t border-cream-100 pt-3 mt-2">
                    <span className="font-semibold text-ink">Grand total</span>
                    <span className="font-display text-3xl text-ink">{formatINR(quote.data.grandTotal)}</span>
                  </div>
                  <p className="text-xs text-ink-soft">Payment: pay at the hotel</p>
                </div>
              ) : (
                <p className="text-ink-soft">{apiError(quote.error)}</p>
              )}
            </div>
          </PublicCard>

          {hotel.onlineBookingNote && (
            <Notice tone="info"><span className="font-semibold">Note from the hotel: </span>{hotel.onlineBookingNote}</Notice>
          )}

          <NavButtons
            onBack={() => setStep(3)}
            onNext={payNow}
            busy={book.isPending}
            nextDisabled={!quote.data}
            nextLabel={book.isPending ? 'Confirming…' : 'Pay Now'}
            nextIcon={CreditCard}
          />
          {!config?.paymentEnabled && (
            <p className="text-xs text-ink-soft text-center sm:text-right">Online payment will be available soon. Your room is confirmed now and you pay at the hotel.</p>
          )}
        </div>
      )}
    </PublicShell>
  );
}

export default function BookPage() {
  const { slug } = useParams();
  return slug ? <BookingFlow key={slug} slug={slug} /> : <HotelPicker />;
}
