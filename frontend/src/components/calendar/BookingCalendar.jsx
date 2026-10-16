import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, BedDouble, Wrench, RefreshCw, AlertTriangle, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCalendar, dataOf } from '../../api/services';
import { SkeletonTable } from '../Skeleton';
import EmptyState from '../EmptyState';
import BookingDrawer from './BookingDrawer';
import { dayjs, TZ, formatDateTime } from '../../utils/date';
import { formatINR } from '../../utils/currency';
import { STATUS_BADGE, ACTIVE_STATUSES, todayIST, addDays, nightSpan, matchesSearch } from './calendarUtils';

const RANGES = [7, 14, 30];
const MOBILE_QUERY = '(max-width: 767px)';

function useIsMobile() {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(MOBILE_QUERY).matches;
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_QUERY);
    if (!mq) return undefined;
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return mobile;
}

/** Floating booking summary for hover (desktop) or first tap (mobile). */
function BarTooltip({ tip, interactive, onOpen }) {
  if (!tip) return null;
  const b = tip.booking;
  const width = 272;
  const left = Math.min(Math.max(8, tip.x - width / 2), window.innerWidth - width - 8);
  const above = tip.y > 220;
  return createPortal(
    <div
      role="tooltip"
      className={`fixed z-[60] w-[272px] rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 shadow-2xl p-3 text-xs ${interactive ? '' : 'pointer-events-none'}`}
      style={{ left, top: above ? tip.y - 8 : tip.bottom + 8, transform: above ? 'translateY(-100%)' : 'none' }}
      data-cal-tooltip
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-ink-900 dark:text-white truncate">{b.guest?.name || 'Guest'}</p>
          {b.guest?.phone && <p className="text-ink-500 dark:text-ink-400">{b.guest.phone}</p>}
        </div>
        <span className={`badge ${STATUS_BADGE[b.status] || 'badge-slate'} flex-shrink-0`}>{b.status}</span>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ink-600 dark:text-ink-300">
        <dt>Booking</dt><dd className="text-right">{b.bookingNo}{b.source === 'Online' ? ` · Online ${b.onlineRef || ''}` : ''}</dd>
        <dt>Rooms</dt><dd className="text-right">{b.rooms.map((r) => `${r.roomNumber}${r.type ? ` (${r.type})` : ''}`).join(', ')}</dd>
        <dt>Check-in</dt><dd className="text-right">{formatDateTime(b.checkIn)}</dd>
        <dt>Check-out</dt><dd className="text-right">{formatDateTime(b.checkOut)}</dd>
        <dt>Nights</dt><dd className="text-right">{b.nights}</dd>
        <dt>Amount</dt><dd className="text-right">{formatINR(b.grandTotal)}</dd>
        <dt>Balance</dt><dd className={`text-right font-semibold ${b.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{formatINR(b.balance)}</dd>
      </dl>
      {interactive && (
        <button type="button" onClick={onOpen} className="btn-primary w-full justify-center mt-3 !py-1.5 text-xs">
          Open details
        </button>
      )}
    </div>,
    document.body
  );
}

/**
 * Room × day booking calendar for the selected hotel.
 * `search` / `type` are shared with the list view; everything else is calendar-only state.
 */
export default function BookingCalendar({ hotelId, search, onSearch, type, onType }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [range, setRange] = useState(() => (typeof window !== 'undefined' && window.matchMedia?.(MOBILE_QUERY).matches ? 7 : 14));
  const [from, setFrom] = useState(todayIST);
  const [statuses, setStatuses] = useState(ACTIVE_STATUSES);
  const [showCancelled, setShowCancelled] = useState(false);
  const [tip, setTip] = useState(null); // { booking, x, y, bottom, touch }
  const [drawer, setDrawer] = useState(null); // booking snapshot
  const [sel, setSelState] = useState(null); // { roomId, a, b } drag selection
  const selRef = useRef(null);
  const setSel = useCallback((next) => {
    const value = typeof next === 'function' ? next(selRef.current) : next;
    selRef.current = value;
    setSelState(value);
  }, []);
  const dragging = useRef(false);
  const suppressClick = useRef(false);
  const lastPointer = useRef('mouse');
  const to = addDays(from, range - 1);
  const today = todayIST();

  // Small screens start with a week
  useEffect(() => { if (isMobile) setRange((r) => Math.min(r, 7)); }, [isMobile]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['calendar', hotelId, from, to, showCancelled],
    queryFn: () => getCalendar({ hotelId, from, to, includeCancelled: showCancelled }).then(dataOf),
    enabled: !!hotelId,
    placeholderData: keepPreviousData,
  });

  // Always lay out from the data's own range (placeholder data may still be the previous range)
  const viewFrom = data?.from || from;
  const dates = useMemo(() => (data?.occupancy || []).map((o) => o.date), [data]);
  const days = dates.length;
  const rooms = useMemo(() => data?.rooms || [], [data]);

  // Bars per room, plus nights already taken (any non-cancelled booking) per room
  const { barsByRoom, busy } = useMemo(() => {
    const bars = new Map();
    const taken = new Map();
    for (const b of data?.bookings || []) {
      const { start, end } = nightSpan(b, viewFrom);
      if (end <= 0 || start >= days) continue;
      const shown = b.status === 'Cancelled' ? showCancelled : statuses.includes(b.status);
      for (const r of b.rooms) {
        const id = String(r.roomId);
        if (b.status !== 'Cancelled') {
          if (!taken.has(id)) taken.set(id, new Set());
          for (let i = Math.max(0, start); i < Math.min(days, end); i += 1) taken.get(id).add(i);
        }
        if (!shown) continue;
        if (!bars.has(id)) bars.set(id, []);
        bars.get(id).push({ booking: b, entry: r, start, end });
      }
    }
    // Cancelled bars underneath active ones
    bars.forEach((list) => list.sort((x, y) => (x.booking.status === 'Cancelled' ? -1 : 0) - (y.booking.status === 'Cancelled' ? -1 : 0)));
    return { barsByRoom: bars, busy: taken };
  }, [data, viewFrom, days, statuses, showCancelled]);

  // Keep the drawer in sync with refreshed data (status / balance changes)
  const drawerBooking = drawer ? (data?.bookings || []).find((b) => b._id === drawer._id) || drawer : null;

  // ---------------------------------------------------------------- empty-cell selection → New Booking
  const finishSelection = useCallback(
    (selection) => {
      const room = rooms.find((r) => String(r._id) === selection.roomId);
      if (!room) return;
      const lo = Math.min(selection.a, selection.b);
      const hi = Math.max(selection.a, selection.b);
      if (room.status === 'Maintenance') {
        toast.error(`Room ${room.roomNumber} is under maintenance`);
        return;
      }
      const taken = busy.get(selection.roomId);
      for (let i = lo; i <= hi; i += 1) {
        if (taken?.has(i)) {
          toast.error(`Room ${room.roomNumber} is not free on ${dayjs.tz(dates[i], TZ).format('DD MMM')}`);
          return;
        }
      }
      navigate('/admin/bookings/new', {
        state: { prefill: { roomId: String(room._id), roomNumber: room.roomNumber, checkIn: dates[lo], checkOut: addDays(dates[hi], 1) } },
      });
    },
    [rooms, busy, dates, navigate]
  );

  useEffect(() => {
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const current = selRef.current;
      setSel(null);
      if (current && current.a !== current.b) {
        suppressClick.current = true; // the click that follows belongs to this drag
        finishSelection(current);
      }
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [finishSelection, setSel]);

  // Close a tapped tooltip when tapping elsewhere or scrolling the grid
  useEffect(() => {
    if (!tip?.touch) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('[data-cal-tooltip],[data-cal-bar]')) setTip(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [tip]);

  const anchorTip = (e, booking, touch) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTip({ booking, x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom, touch });
  };

  // ---------------------------------------------------------------- controls
  const shift = (n) => setFrom((f) => addDays(f, n));
  const toggleStatus = (s) => setStatuses((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  const rangeLabel = `${dayjs.tz(from, TZ).format('DD MMM')} – ${dayjs.tz(to, TZ).format('DD MMM YYYY')}`;

  const cols = `minmax(6.5rem, 7.5rem) repeat(${Math.max(days, 1)}, minmax(2.75rem, 1fr))`;
  const minWidth = `calc(7rem + ${Math.max(days, 1)} * 2.75rem)`;

  const dayMeta = dates.map((d) => {
    const dj = dayjs.tz(d, TZ);
    return { d, isToday: d === today, isWeekend: [0, 6].includes(dj.day()), dow: dj.format('ddd'), label: dj.format('D MMM') };
  });

  const cellTint = (m) => (m.isToday ? 'bg-brand-500/10' : m.isWeekend ? 'bg-ink-100/60 dark:bg-ink-700/25' : '');

  return (
    <>
      {/* Filters + calendar navigation */}
      <div className="card mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input className="input pl-9" placeholder="Search guest name or phone…" value={search} onChange={(e) => onSearch(e.target.value)} />
          </div>
          <select className="input w-auto" value={type} onChange={(e) => onType(e.target.value)}>
            <option value="">All Types</option>
            <option>AC</option>
            <option>Non-AC</option>
          </select>
          <div className="flex flex-wrap items-center gap-2">
            {ACTIVE_STATUSES.map((s) => (
              <label key={s} className={`badge ${STATUS_BADGE[s]} cursor-pointer select-none gap-1.5 !py-1 ${statuses.includes(s) ? '' : 'opacity-40'}`}>
                <input type="checkbox" className="accent-brand-600 w-3.5 h-3.5" checked={statuses.includes(s)} onChange={() => toggleStatus(s)} />
                {s}
              </label>
            ))}
            <label className="inline-flex items-center gap-1.5 text-sm text-ink-600 dark:text-ink-300 cursor-pointer select-none">
              <input type="checkbox" className="accent-brand-600 w-4 h-4" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
              Show cancelled
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shift(-range)} className="btn-secondary !px-2.5" aria-label="Previous"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => setFrom(todayIST())} className="btn-secondary">Today</button>
            <button type="button" onClick={() => shift(range)} className="btn-secondary !px-2.5" aria-label="Next"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <input
            type="date"
            className="input w-auto"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            aria-label="Jump to date"
          />
          <div className="inline-flex rounded-lg bg-ink-100 dark:bg-ink-700/60 p-1" role="group" aria-label="Days shown">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  range === r ? 'bg-white dark:bg-ink-800 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white'
                }`}
              >
                {r} days
              </button>
            ))}
          </div>
          <span className="text-sm font-medium text-ink-700 dark:text-ink-200 ml-auto">
            {rangeLabel}
            {isFetching && !isLoading && <RefreshCw className="inline w-3.5 h-3.5 ml-2 animate-spin text-ink-400" />}
          </span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600 dark:text-ink-300">
          {Object.entries(STATUS_BADGE).map(([s, cls]) => (
            <span key={s} className={`badge ${cls} ${s === 'Cancelled' ? 'cal-striped' : ''}`}>{s}</span>
          ))}
          <span className="badge badge-slate cal-hatch">Maintenance</span>
          <span className="inline-flex items-center gap-1"><span className="badge badge-red !px-1.5">₹</span> Balance due</span>
          <span className="hidden md:inline ml-auto text-ink-500 dark:text-ink-400">Click or drag across empty days to book</span>
          <span className="md:hidden ml-auto text-ink-500 dark:text-ink-400">Tap a bar for details · tap an empty day to book</span>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <SkeletonTable rows={8} cols={8} />
      ) : isError ? (
        <div className="card flex flex-col items-center text-center gap-3 py-10">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-ink-700 dark:text-ink-200">{error?.response?.data?.message || 'Could not load the calendar.'}</p>
          <button type="button" onClick={() => refetch()} className="btn-primary"><RefreshCw className="w-4 h-4" /> Retry</button>
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms yet"
          description="Add rooms to this hotel to see them on the calendar."
          action={() => navigate('/admin/rooms')}
          actionLabel="Go to Rooms"
        />
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div
            className="overflow-auto max-h-[calc(100vh-18rem)] min-h-[16rem] overscroll-contain"
            onScroll={() => tip && !tip.touch && setTip(null)}
          >
            <div style={{ minWidth }} className="text-sm">
              {/* Header */}
              <div className="grid sticky top-0 z-[4] bg-white dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700" style={{ gridTemplateColumns: cols }}>
                <div className="sticky left-0 z-[5] bg-white dark:bg-ink-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 border-r border-ink-200 dark:border-ink-700 flex items-end">
                  Room
                </div>
                {dayMeta.map((m) => (
                  <div key={m.d} className={`px-1 py-2 text-center border-l border-ink-100 dark:border-ink-700 ${cellTint(m)}`}>
                    <p className={`text-[11px] uppercase ${m.isToday ? 'text-brand-700 dark:text-brand-300 font-semibold' : 'text-ink-500 dark:text-ink-400'}`}>{m.dow}</p>
                    <p className={`text-xs whitespace-nowrap ${m.isToday ? 'font-bold text-brand-700 dark:text-brand-300' : 'font-medium text-ink-800 dark:text-ink-100'}`}>{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Rooms */}
              {rooms.map((room) => {
                const id = String(room._id);
                const bars = barsByRoom.get(id) || [];
                const maintenance = room.status === 'Maintenance';
                return (
                  <div key={id} className="grid relative border-b border-ink-100 dark:border-ink-700/70" style={{ gridTemplateColumns: cols }}>
                    <div className="sticky left-0 z-[3] bg-white dark:bg-ink-800 px-3 py-1.5 border-r border-ink-200 dark:border-ink-700 flex flex-col justify-center" style={{ gridRow: 1, gridColumn: 1 }}>
                      <p className="font-semibold text-ink-900 dark:text-white leading-tight flex items-center gap-1">
                        {room.roomNumber}
                        {maintenance && <Wrench className="w-3.5 h-3.5 text-amber-600" aria-label="Maintenance" />}
                      </p>
                      <p className="text-[10px] text-ink-500 dark:text-ink-400 leading-tight truncate">
                        {room.type}{room.floor ? ` · F${room.floor}` : ''}
                      </p>
                    </div>

                    {/* Day cells (click / drag to book) */}
                    {dayMeta.map((m, i) => {
                      const selected = sel && sel.roomId === id && i >= Math.min(sel.a, sel.b) && i <= Math.max(sel.a, sel.b);
                      return (
                        <button
                          key={m.d}
                          type="button"
                          aria-label={`Room ${room.roomNumber}, ${m.label}`}
                          style={{ gridRow: 1, gridColumn: i + 2 }}
                          className={`h-12 min-h-[40px] border-l border-ink-100 dark:border-ink-700/70 transition-colors hover:bg-brand-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${cellTint(m)} ${selected ? '!bg-brand-500/30' : ''}`}
                          onPointerDown={(e) => {
                            lastPointer.current = e.pointerType;
                            if (e.pointerType !== 'mouse' || e.button !== 0) return;
                            dragging.current = true;
                            setSel({ roomId: id, a: i, b: i });
                          }}
                          onPointerEnter={() => {
                            if (dragging.current) setSel((s) => (s && s.roomId === id ? { ...s, b: i } : s));
                          }}
                          onClick={() => {
                            if (suppressClick.current) { suppressClick.current = false; return; }
                            finishSelection({ roomId: id, a: i, b: i });
                          }}
                        />
                      );
                    })}

                    {maintenance && (
                      <div
                        className="cal-hatch pointer-events-none z-[1] flex items-center pl-2 text-[11px] font-medium text-ink-600 dark:text-ink-300"
                        style={{ gridRow: 1, gridColumn: `2 / ${days + 2}` }}
                      >
                        <span className="sticky left-[7.5rem]">Maintenance</span>
                      </div>
                    )}

                    {/* Booking bars */}
                    {bars.map(({ booking: b, entry, start, end }) => {
                      const s = Math.max(0, start);
                      const e = Math.min(days, end);
                      const cutStart = start < 0;
                      const cutEnd = end > days;
                      const cancelled = b.status === 'Cancelled';
                      const hit = search.trim() && matchesSearch(b, search);
                      const dim = (search.trim() && !hit) || (type && entry.type !== type);
                      return (
                        <button
                          key={`${b._id}-${id}`}
                          type="button"
                          data-cal-bar
                          aria-label={`${b.guest?.name || 'Guest'}, ${b.bookingNo}, ${b.status}${b.source === 'Online' ? ', online booking' : ''}`}
                          style={{ gridRow: 1, gridColumn: `${s + 2} / ${e + 2}` }}
                          className={`badge ${STATUS_BADGE[b.status] || 'badge-slate'} relative self-center h-9 min-w-0 mx-0.5 !px-2 !rounded-md justify-start gap-1 overflow-hidden text-left shadow-sm transition-[opacity,box-shadow] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                            cancelled ? 'cal-striped z-[1]' : 'z-[2]'
                          } ${cutStart ? '!rounded-l-none !ml-0 border-l-2 border-dashed border-current' : ''} ${cutEnd ? '!rounded-r-none !mr-0 border-r-2 border-dashed border-current' : ''} ${
                            dim ? 'opacity-30' : ''
                          } ${hit ? 'ring-2 ring-brand-500' : ''}`}
                          onPointerDown={(ev) => { lastPointer.current = ev.pointerType; }}
                          onPointerEnter={(ev) => { if (ev.pointerType === 'mouse') anchorTip(ev, b, false); }}
                          onPointerLeave={(ev) => { if (ev.pointerType === 'mouse') setTip(null); }}
                          onClick={(ev) => {
                            if (lastPointer.current !== 'mouse' && tip?.booking?._id !== b._id) {
                              anchorTip(ev, b, true); // first tap on touch: show the summary
                              return;
                            }
                            setTip(null);
                            setDrawer(b);
                          }}
                        >
                          {cutStart && <ChevronLeft className="w-3 h-3 flex-shrink-0 -ml-1" />}
                          {b.source === 'Online' && <Globe className="w-3 h-3 flex-shrink-0" aria-hidden="true" data-online-marker />}
                          <span className="truncate min-w-0 flex-1">{b.guest?.name || b.bookingNo}</span>
                          {b.balance > 0 && !cancelled && <span className="badge badge-red !px-1.5 !py-0 text-[10px] flex-shrink-0" title={`Balance ${formatINR(b.balance)}`}>₹</span>}
                          {cutEnd && <ChevronRight className="w-3 h-3 flex-shrink-0 -mr-1" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Occupancy */}
              <div className="grid sticky bottom-0 z-[4] bg-ink-50 dark:bg-ink-900 border-t border-ink-200 dark:border-ink-700" style={{ gridTemplateColumns: cols }}>
                <div className="sticky left-0 z-[5] bg-ink-50 dark:bg-ink-900 px-3 py-2 text-xs font-semibold text-ink-600 dark:text-ink-300 border-r border-ink-200 dark:border-ink-700">
                  Occupancy
                </div>
                {(data?.occupancy || []).map((o) => {
                  const pct = o.totalRooms ? Math.round((o.occupied / o.totalRooms) * 100) : 0;
                  return (
                    <div key={o.date} className={`px-1 py-1.5 text-center border-l border-ink-100 dark:border-ink-700 ${o.date === today ? 'bg-brand-500/10' : ''}`}>
                      <p className="text-xs font-semibold text-ink-800 dark:text-ink-100">{o.occupied}/{o.totalRooms}</p>
                      <p className="text-[10px] text-ink-500 dark:text-ink-400">{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <BarTooltip tip={tip} interactive={!!tip?.touch} onOpen={() => { setDrawer(tip.booking); setTip(null); }} />
      {drawerBooking && <BookingDrawer booking={drawerBooking} onClose={() => setDrawer(null)} />}
    </>
  );
}
