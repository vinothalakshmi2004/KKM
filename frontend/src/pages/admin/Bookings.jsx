import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getBookings } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { Plus, Search, CalendarCheck, List, CalendarDays, Download } from 'lucide-react';
import BookingCalendar from '../../components/calendar/BookingCalendar';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { formatDate } from '../../utils/date';
import { formatINR } from '../../utils/currency';
import OnlineTag from '../../components/OnlineTag';
import BookingExportModal from '../../components/BookingExportModal';
import { formatRooms } from '../../utils/rooms';
import { bookingPayment } from '../../utils/paymentStatus';

const VIEW_KEY = 'bookingsView';

/** List | Calendar switch shown next to "New Booking". */
function ViewToggle({ view, onChange }) {
  const options = [
    { value: 'list', label: 'List', icon: List },
    { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  ];
  return (
    <div className="inline-flex rounded-lg bg-ink-100 dark:bg-ink-700/60 p-1" role="group" aria-label="Bookings view">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={view === value}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            view === value ? 'bg-white dark:bg-ink-800 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white'
          }`}
        >
          <Icon className="w-4 h-4" /> {label}
        </button>
      ))}
    </div>
  );
}

const STATUS_BADGE = {
  Booked: 'badge-blue',
  'Checked-in': 'badge-green',
  'Checked-out': 'badge-slate',
  Cancelled: 'badge-red',
};

export default function Bookings() {
  const { selectedHotelId, hotels } = useHotel();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '', type: '' });

  // List is the default; ?view=calendar in the URL wins, then the last choice
  const [searchParams, setSearchParams] = useSearchParams();
  const urlView = searchParams.get('view');
  const [view, setViewState] = useState(() => {
    if (urlView === 'calendar' || urlView === 'list') return urlView;
    try {
      return localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list';
    } catch {
      return 'list';
    }
  });
  const setView = (next) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage unavailable: keep it for this visit only */
    }
    setSearchParams(next === 'calendar' ? { view: 'calendar' } : {}, { replace: true });
  };
  useEffect(() => {
    if ((urlView === 'calendar' || urlView === 'list') && urlView !== view) setViewState(urlView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlView]);

  const search = useDebounce(filters.search);
  const query = { ...filters, search };

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', selectedHotelId, page, query],
    queryFn: () =>
      getBookings({ hotelId: selectedHotelId, page, limit: 20, ...query })
        .then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId && view === 'list',
    placeholderData: keepPreviousData,
  });

  const bookings = data?.items || data || [];
  const pages = data?.pages ?? Math.max(1, Math.ceil((data?.total || 0) / 20));

  useEffect(() => setPage(1), [selectedHotelId]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const setFilter = (key, val) => { setFilters((f) => ({ ...f, [key]: val })); setPage(1); };

  if (!selectedHotelId) {
    return <EmptyState title="No hotel selected" description="Select a hotel from the top bar." />;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Bookings</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <button onClick={() => setExportOpen(true)} className="btn-secondary">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => navigate('/admin/bookings/new')} className="btn-primary">
            <Plus className="w-4 h-4" /> New Booking
          </button>
        </div>
      </div>
      {exportOpen && (
        <BookingExportModal
          hotelId={selectedHotelId}
          hotelName={hotels.find((h) => (h._id || h.id) === selectedHotelId)?.name}
          onClose={() => setExportOpen(false)}
        />
      )}

      {view === 'calendar' ? (
        <BookingCalendar
          hotelId={selectedHotelId}
          search={filters.search}
          onSearch={(v) => setFilter('search', v)}
          type={filters.type}
          onType={(v) => setFilter('type', v)}
        />
      ) : (
      <>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search guest name or phone…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          <select className="input w-auto" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All Status</option>
            <option>Booked</option>
            <option>Checked-in</option>
            <option>Checked-out</option>
            <option>Cancelled</option>
          </select>
          <select className="input w-auto" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
            <option value="">All Types</option>
            <option>AC</option>
            <option>Non-AC</option>
          </select>
          <input type="date" className="input w-auto" placeholder="From" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          <input type="date" className="input w-auto" placeholder="To" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => { setFilters({ search: '', status: '', from: '', to: '', type: '' }); setPage(1); }} className="btn-ghost text-sm">
              Clear
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : bookings.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No bookings found" description="Start by creating a new booking." action={() => navigate('/admin/bookings/new')} actionLabel="New Booking" />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {bookings.map((b) => (
              <div key={b._id || b.id} onClick={() => navigate(`/admin/bookings/${b._id || b.id}`)} className="card cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-white">{b.guestId?.name || '—'}{b.source === 'Online' && <OnlineTag />}</p>
                    <p className="text-sm text-ink-500">{b.guestId?.phone}</p>
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    <span className={`badge ${STATUS_BADGE[b.status] || 'badge-slate'}`}>{b.status}</span>
                    {bookingPayment(b) && <span className={`badge ${bookingPayment(b).badge}`}>{bookingPayment(b).label}</span>}
                  </span>
                </div>
                <div className="mt-2 text-sm text-ink-500 dark:text-ink-400 space-y-0.5">
                  <p>Rooms: {formatRooms(b.rooms)}</p>
                  <p>{formatDate(b.checkIn)} → {formatDate(b.checkOut)}</p>
                  <p className="font-semibold text-ink-700 dark:text-ink-300">{formatINR(b.grandTotal)} · Bal: {formatINR(b.balance)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Rooms</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b._id || b.id} onClick={() => navigate(`/admin/bookings/${b._id || b.id}`)} className="cursor-pointer">
                    <td>
                      <p className="font-medium text-ink-900 dark:text-white">{b.guestId?.name || '—'}{b.source === 'Online' && <OnlineTag />}</p>
                      <p className="text-xs text-ink-400">{b.guestId?.phone}</p>
                    </td>
                    <td>{formatRooms(b.rooms) || '—'}</td>
                    <td>{formatDate(b.checkIn)}</td>
                    <td>{formatDate(b.checkOut)}</td>
                    <td className="font-medium">{formatINR(b.grandTotal)}</td>
                    <td className={b.balance > 0 ? 'text-red-500 font-medium' : 'text-emerald-500 font-medium'}>{formatINR(b.balance)}</td>
                    <td className="whitespace-nowrap">{bookingPayment(b) ? <span className={`badge ${bookingPayment(b).badge}`}>{bookingPayment(b).label}</span> : '—'}</td>
                    <td className="whitespace-nowrap"><span className={`badge ${STATUS_BADGE[b.status] || 'badge-slate'}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </>
      )}
      </>
      )}
    </div>
  );
}
