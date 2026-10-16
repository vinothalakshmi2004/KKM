import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Globe, CheckCheck, Check, ExternalLink, BedDouble, CalendarDays, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOnlineBookings, markOnlineBookingSeen, markAllOnlineBookingsSeen, dataOf } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { useDebounce } from '../../hooks/useDebounce';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { formatDateTime } from '../../utils/date';
import { formatINR } from '../../utils/currency';

const STATUS_BADGE = {
  Booked: 'badge-blue',
  'Checked-in': 'badge-green',
  'Checked-out': 'badge-slate',
  Cancelled: 'badge-red',
};

const TABS = [
  { value: 'new', label: 'New' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'checked-in', label: 'Checked-in' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

const NewTag = () => <span className="badge badge-yellow">New</span>;

const roomsText = (rooms = []) => rooms.map((r) => `${r.roomNumber} (${r.type})`).join(', ');

export default function OnlineBookings() {
  const { selectedHotelId } = useHotel();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('new');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', from: '', to: '' });
  const search = useDebounce(filters.search);

  const { data, isLoading } = useQuery({
    queryKey: ['online-bookings', selectedHotelId, tab, page, filters.from, filters.to, search],
    queryFn: () =>
      getOnlineBookings({ hotelId: selectedHotelId, status: tab, page, limit: 20, from: filters.from, to: filters.to, search }).then(dataOf),
    enabled: !!selectedHotelId,
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];
  const pages = data?.pages ?? 1;
  const unseen = data?.unseen ?? 0;

  useEffect(() => setPage(1), [selectedHotelId, tab]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const refresh = () => ['online-bookings', 'online-unseen'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

  const seenOne = useMutation({
    mutationFn: (id) => markOnlineBookingSeen(id),
    onSuccess: refresh,
    onError: () => toast.error('Could not mark as seen'),
  });
  const seenAll = useMutation({
    mutationFn: () => markAllOnlineBookingsSeen(selectedHotelId),
    onSuccess: (r) => { toast.success(dataOf(r)?.modified ? 'All online bookings marked as seen' : 'Nothing new to mark'); refresh(); },
    onError: () => toast.error('Could not mark all as seen'),
  });

  const setFilter = (key, val) => { setFilters((f) => ({ ...f, [key]: val })); setPage(1); };
  const open = (b) => navigate(`/admin/bookings/${b._id}`); // the detail page marks it as seen

  if (!selectedHotelId) {
    return <EmptyState title="No hotel selected" description="Select a hotel from the top bar." />;
  }

  const SeenButton = ({ b, className = '' }) =>
    !b.seenByAdmin && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); seenOne.mutate(b._id); }}
        disabled={seenOne.isPending}
        className={`btn-ghost !px-2 !py-1 text-xs ${className}`}
      >
        <Check className="w-3.5 h-3.5" /> Mark as seen
      </button>
    );

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Online Bookings</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Booked by guests on the website and confirmed instantly.</p>
        </div>
        <button type="button" onClick={() => seenAll.mutate()} disabled={!unseen || seenAll.isPending} className="btn-secondary">
          <CheckCheck className="w-4 h-4" /> Mark all as seen{unseen ? ` (${unseen})` : ''}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 -mx-1 px-1" role="tablist" aria-label="Online booking status">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.value
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700'
            }`}
          >
            {t.label}
            {t.value === 'new' && unseen > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-700 text-white text-[11px] font-bold leading-5 text-center">{unseen}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search reference, booking no, guest, phone or room…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          <input type="date" className="input w-auto" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="Stay from" />
          <input type="date" className="input w-auto" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="Stay to" />
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => { setFilters({ search: '', from: '', to: '' }); setPage(1); }} className="btn-ghost text-sm">Clear</button>
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Globe}
          title={tab === 'new' ? 'No new online bookings' : 'No online bookings found'}
          description={tab === 'new' ? 'New bookings from the website appear here instantly.' : 'Try another tab or clear the filters.'}
        />
      ) : (
        <>
          {/* Cards: phones and tablets */}
          <div className="xl:hidden grid gap-3 sm:grid-cols-2">
            {items.map((b) => (
              <div
                key={b._id}
                onClick={() => open(b)}
                className={`card cursor-pointer hover:shadow-md transition-shadow ${!b.seenByAdmin ? 'ring-2 ring-brand-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900 dark:text-white flex items-center gap-2 flex-wrap">
                      {b.onlineRef} {!b.seenByAdmin && <NewTag />}
                    </p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">{b.bookingNo}</p>
                  </div>
                  <span className={`badge ${STATUS_BADGE[b.status] || 'badge-slate'} flex-shrink-0`}>{b.status}</span>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <p className="font-medium text-ink-900 dark:text-white">{b.guestId?.name || '—'}</p>
                  {b.guestId?.phone && (
                    <a href={`tel:${b.guestId.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-ink-600 dark:text-ink-300">
                      <Phone className="w-3.5 h-3.5" /> {b.guestId.phone}
                    </a>
                  )}
                  <p className="flex items-center gap-1.5 font-semibold text-ink-900 dark:text-white">
                    <BedDouble className="w-4 h-4 text-brand-600" /> Room {roomsText(b.rooms)}
                  </p>
                  <p className="flex items-start gap-1.5 text-ink-600 dark:text-ink-300">
                    <CalendarDays className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{formatDateTime(b.checkIn)} → {formatDateTime(b.checkOut)} · {b.nights} night{b.nights === 1 ? '' : 's'}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold text-ink-900 dark:text-white">{formatINR(b.grandTotal)}</span>
                    <span className={b.balance > 0 ? 'text-red-500 font-medium' : 'text-emerald-500 font-medium'}>Bal {formatINR(b.balance)}</span>
                    <span className="badge badge-slate">{b.online?.paymentStatus || 'Pay at hotel'}</span>
                  </div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Booked {formatDateTime(b.createdAt)}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-700 flex flex-wrap gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); open(b); }} className="btn-primary !py-1.5 text-xs">
                    <ExternalLink className="w-3.5 h-3.5" /> View booking
                  </button>
                  <SeenButton b={b} />
                </div>
              </div>
            ))}
          </div>

          {/* Table: desktop */}
          <div className="hidden xl:block table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Guest</th>
                  <th>Rooms</th>
                  <th>Stay</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Booked at</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b._id} onClick={() => open(b)} className={`cursor-pointer ${!b.seenByAdmin ? 'font-semibold' : ''}`}>
                    <td>
                      <p className="font-medium text-ink-900 dark:text-white flex items-center gap-2 whitespace-nowrap">{b.onlineRef} {!b.seenByAdmin && <NewTag />}</p>
                      <p className="text-xs text-ink-400">{b.bookingNo}</p>
                    </td>
                    <td>
                      <p className="font-medium text-ink-900 dark:text-white">{b.guestId?.name || '—'}</p>
                      <p className="text-xs text-ink-400">{b.guestId?.phone}</p>
                    </td>
                    <td className="font-semibold text-ink-900 dark:text-white whitespace-nowrap">{roomsText(b.rooms)}</td>
                    <td className="whitespace-nowrap">
                      <p>{formatDateTime(b.checkIn)}</p>
                      <p className="text-xs text-ink-400">→ {formatDateTime(b.checkOut)} · {b.nights}N</p>
                    </td>
                    <td className="font-medium">{formatINR(b.grandTotal)}</td>
                    <td>
                      <p className={b.balance > 0 ? 'text-red-500 font-medium' : 'text-emerald-500 font-medium'}>{formatINR(b.balance)}</p>
                      <p className="text-xs text-ink-400 whitespace-nowrap">{b.online?.paymentStatus || 'Pay at hotel'}</p>
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[b.status] || 'badge-slate'}`}>{b.status}</span></td>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(b.createdAt)}</td>
                    <td className="whitespace-nowrap text-right">
                      <SeenButton b={b} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
