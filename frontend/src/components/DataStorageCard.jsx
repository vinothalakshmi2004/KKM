import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Trash2, Download, Lock, UserX, Info, CalendarCheck, TrendingUp, Receipt, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  dataOf, getStorageSummary, deleteUnusedGuests,
  getBookingsByMonth, deleteBookingsByMonth, getIncomeByMonth, deleteIncomeByMonth, getExpensesByMonth, deleteExpensesByMonth,
} from '../api/services';
import { useHotel } from '../context/HotelContext';
import ConfirmDialog from './ConfirmDialog';
import { formatINR } from '../utils/currency';
import { downloadCSV } from '../utils/csv';
import { bookingRows, expenseRows, incomeRows } from '../utils/monthExports';
import { dayjs, TZ } from '../utils/date';

export const formatBytes = (n = 0) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

const thisMonth = () => dayjs().tz(TZ).format('YYYY-MM');
const lastMonth = () => dayjs().tz(TZ).subtract(1, 'month').format('YYYY-MM');
const REFRESH = ['storage', 'bookings', 'bookings-by-month', 'calendar', 'dashboard', 'payments', 'reports', 'income',
  'expenses', 'guests', 'online-bookings', 'online-unseen', 'rooms', 'month-data'];

/** The three exports: each is downloaded and deleted separately. */
const KINDS = {
  bookings: {
    title: 'Bookings & guest details',
    icon: CalendarCheck,
    fetch: getBookingsByMonth,
    remove: deleteBookingsByMonth,
    rows: bookingRows,
    file: 'bookings',
    exportNote: 'Booking, guest name, phone, address, Aadhaar number, number of guests, rooms, dates and times, amounts and payments.',
    deleteNote: 'Deletes the finished bookings and their guests’ details (guest record, Aadhaar, ID files). Income and expenses are NOT touched.',
    summary: (d) => `${d.total} booking${d.total === 1 ? '' : 's'} · ${d.deletableCount} can be deleted${d.activeCount ? ` · ${d.activeCount} still Booked / Checked-in (kept)` : ''}`,
    done: (r) => `${r.deleted} booking(s) and ${r.guests} guest(s) deleted · ${r.paymentsKept} payment(s) kept in income${r.kept ? ` · ${r.kept} active kept` : ''}`,
  },
  income: {
    title: 'Income',
    icon: TrendingUp,
    fetch: getIncomeByMonth,
    remove: deleteIncomeByMonth,
    rows: incomeRows,
    file: 'income',
    exportNote: 'Every payment received: date, time, amount, mode, note and booking number.',
    deleteNote: 'Deletes the selected period’s payments. Payments of bookings that still exist are kept (delete those bookings first).',
    summary: (d) => `${d.total} payment${d.total === 1 ? '' : 's'} · ${formatINR(d.amount)}${d.linkedCount ? ` · ${d.linkedCount} linked to existing bookings (kept)` : ''}`,
    done: (r) => `${r.deleted} payment(s) deleted${r.kept ? ` · ${r.kept} kept (booking still exists)` : ''}`,
  },
  expenses: {
    title: 'Expenses',
    icon: Receipt,
    fetch: getExpensesByMonth,
    remove: deleteExpensesByMonth,
    rows: expenseRows,
    file: 'expenses',
    exportNote: 'Every expense: date, category, paid to, amount, mode, note and bill file names.',
    deleteNote: 'Deletes the selected period’s expenses and their uploaded bills.',
    summary: (d) => `${d.total} expense${d.total === 1 ? '' : 's'} · ${formatINR(d.amount)}`,
    done: (r) => `${r.deleted} expense(s) deleted`,
  },
};

function MonthPanel({ kind, hotelId, hotelName, params, periodKey, valid }) {
  const cfg = KINDS[kind];
  const queryClient = useQueryClient();
  const [downloaded, setDownloaded] = useState(() => new Set());
  const [confirm, setConfirm] = useState(false);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['month-data', kind, hotelId, periodKey],
    queryFn: () => cfg.fetch({ hotelId, ...params }).then(dataOf),
    enabled: valid,
  });

  const remove = useMutation({
    mutationFn: () => cfg.remove({ hotelId, ...params }).then(dataOf),
    onSuccess: (r) => {
      setConfirm(false);
      toast.success(cfg.done(r), { duration: 6000 });
      REFRESH.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: (err) => { setConfirm(false); toast.error(err.response?.data?.message || 'Could not delete'); },
  });

  const download = () => {
    const safe = hotelName.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    downloadCSV(`${cfg.file}-${safe}-${periodKey}.csv`, cfg.rows(data.items));
    setDownloaded((s) => new Set(s).add(periodKey));
    toast.success(`${cfg.title}: ${data.label} downloaded`);
  };

  // Something before the current month is in the period (the current month is never deleted)
  const isPast = valid && (data ? data.deletable : true);
  const wasDownloaded = downloaded.has(periodKey);
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4 flex flex-col gap-3" data-panel={kind}>
      <p className="font-semibold text-ink-900 dark:text-white flex items-center gap-2"><Icon className="w-4 h-4 text-brand-600" /> {cfg.title}</p>
      <p className="text-sm text-ink-700 dark:text-ink-200 min-h-[2.5rem]">
        {!valid ? 'Choose a valid period.' : isError ? 'Could not load.' : !data || isFetching ? 'Loading…' : `${data.label}: ${cfg.summary(data)}`}
      </p>
      <p className="text-xs text-ink-500 dark:text-ink-400">{cfg.exportNote}</p>
      <button type="button" onClick={download} disabled={!data || isFetching || !data.total} className="btn-primary justify-center">
        {wasDownloaded ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />} {wasDownloaded ? 'Downloaded' : 'Export CSV'}
      </button>
      <div className="mt-auto pt-3 border-t border-ink-100 dark:border-ink-700 space-y-2">
        <p className="text-xs text-ink-500 dark:text-ink-400">{cfg.deleteNote}</p>
        {!isPast ? (
          <p className="text-xs text-ink-600 dark:text-ink-300 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Current month cannot be deleted</p>
        ) : kind === 'bookings' && data && !data.deletableCount && data.activeCount ? (
          <p className="text-xs text-ink-600 dark:text-ink-300 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {data.activeCount} are still Booked / Checked-in. Check out or cancel them first.
          </p>
        ) : !wasDownloaded && data?.deletableCount > 0 ? (
          <p className="text-xs text-ink-600 dark:text-ink-300 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Export first, then delete</p>
        ) : null}
        {isPast && data?.currentMonthCount > 0 && (
          <p className="text-xs text-ink-600 dark:text-ink-300 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {data.currentMonthCount} from the current month will be kept</p>
        )}
        <button
          type="button"
          onClick={() => setConfirm(true)}
          disabled={!isPast || !wasDownloaded || !data?.deletableCount || remove.isPending}
          className="btn-danger w-full justify-center"
        >
          <Trash2 className="w-4 h-4" /> {remove.isPending ? 'Deleting…' : `Delete${data?.deletableCount ? ` ${data.deletableCount}` : ''}`}
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={`Delete ${cfg.title.toLowerCase()} of ${data?.label}?`}
        message={`${cfg.deleteNote} ${data?.deletableCount} record(s) will be permanently removed from the database of ${hotelName}. This cannot be undone.`}
        confirmLabel="Delete permanently"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

/**
 * Settings → Data & Storage: storage use, a month overview, and for the chosen month three separate
 * exports (bookings & guests, income, expenses) that can each be deleted from the database afterwards.
 */
export default function DataStorageCard() {
  const { selectedHotelId, hotels } = useHotel();
  const queryClient = useQueryClient();
  const hotelName = hotels.find((h) => (h._id || h.id) === selectedHotelId)?.name || 'hotel';
  const [periodType, setPeriodType] = useState('month'); // month | range | all
  const [month, setMonth] = useState(lastMonth());
  const [range, setRange] = useState(() => ({ from: `${lastMonth()}-01`, to: dayjs().tz(TZ).subtract(1, 'month').endOf('month').format('YYYY-MM-DD') }));
  const period =
    periodType === 'all'
      ? { params: { all: true }, key: 'all', valid: true }
      : periodType === 'range'
        ? { params: { from: range.from, to: range.to }, key: `${range.from}_to_${range.to}`, valid: !!range.from && !!range.to && range.from <= range.to }
        : { params: { month }, key: month, valid: !!month && month <= thisMonth() };
  const [confirmGuests, setConfirmGuests] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storage', selectedHotelId],
    queryFn: () => getStorageSummary(selectedHotelId).then(dataOf),
    enabled: !!selectedHotelId,
  });

  const guestsMut = useMutation({
    mutationFn: () => deleteUnusedGuests(selectedHotelId).then(dataOf),
    onSuccess: (r) => {
      setConfirmGuests(false);
      toast.success(`${r.deleted} unused guest(s) deleted`);
      ['storage', 'guests'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: (err) => { setConfirmGuests(false); toast.error(err.response?.data?.message || 'Could not delete guests'); },
  });

  const Stat = ({ label, value, hint }) => (
    <div className="rounded-xl bg-ink-50 dark:bg-ink-700/50 p-3">
      <p className="text-xs text-ink-500 dark:text-ink-400">{label}</p>
      <p className="text-lg font-bold text-ink-900 dark:text-white">{value}</p>
      {hint && <p className="text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );

  return (
    <div className="card">
      <h3 className="section-title mb-1 flex items-center gap-2"><Database className="w-5 h-5 text-brand-600" /> Data &amp; Storage</h3>
      <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
        Export a month&apos;s data to keep a copy, then delete it from the database to keep it small. {hotelName}.
      </p>

      {isLoading ? (
        <div className="space-y-2"><div className="skeleton h-16" /><div className="skeleton h-40" /></div>
      ) : isError || !data ? (
        <p className="text-sm text-red-500">Could not load storage details.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Database data" value={formatBytes(data.database.dataBytes)} hint={`${data.database.records.toLocaleString('en-IN')} records · all hotels`} />
            <Stat label="Uploaded files" value={formatBytes(data.database.fileBytes)} hint={`${data.database.fileCount} files · all hotels`} />
            <Stat label="Bookings · guests" value={`${data.hotel.bookings} · ${data.hotel.guests}`} hint={`${data.hotel.documents} docs · ${formatBytes(data.hotel.documentBytes)}`} />
            <Stat label="Payments · expenses" value={`${data.hotel.payments} · ${data.hotel.expenses}`} />
          </div>

          {/* Month overview: click a row to choose the month */}
          {data.months.length > 0 && (
            <div className="table-container max-h-64 overflow-y-auto">
              <table className="table">
                <thead>
                  <tr><th>Month</th><th>Bookings</th><th>Income</th><th>Expenses</th></tr>
                </thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month} onClick={() => { setPeriodType('month'); setMonth(m.month); }} className={`cursor-pointer ${periodType === 'month' && m.month === month ? 'ring-2 ring-inset ring-brand-500' : ''}`}>
                      <td className="whitespace-nowrap font-medium text-ink-900 dark:text-white">
                        {m.label} {!m.deletable && <Lock className="inline w-3 h-3 ml-1" aria-label="current month" />}
                      </td>
                      <td className="whitespace-nowrap">{m.bookings}<span className="block text-xs text-ink-400">{m.files} files · {formatBytes(m.fileBytes)}</span></td>
                      <td className="whitespace-nowrap">{formatINR(m.income)}<span className="block text-xs text-ink-400">{m.incomeCount} payments</span></td>
                      <td className="whitespace-nowrap">{formatINR(m.expenses)}<span className="block text-xs text-ink-400">{m.expenseCount} entries</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Period">
              {[['month', 'One month'], ['range', 'Date range'], ['all', 'All data']].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={periodType === value}
                  onClick={() => setPeriodType(value)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    periodType === value ? 'bg-brand-600 text-white' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {periodType === 'month' && (
                <div>
                  <label className="label" htmlFor="storage-month">Month</label>
                  <input id="storage-month" type="month" className="input w-auto" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
                </div>
              )}
              {periodType === 'range' && (
                <>
                  <div>
                    <label className="label" htmlFor="storage-from">From</label>
                    <input id="storage-from" type="date" className="input w-auto" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label" htmlFor="storage-to">To</label>
                    <input id="storage-to" type="date" className="input w-auto" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                  </div>
                </>
              )}
              {periodType === 'all' && (
                <p className="text-sm text-ink-700 dark:text-ink-200">Everything stored for {hotelName}. Deleting keeps the current month.</p>
              )}
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400">Bookings by check-in date · income by payment date · expenses by expense date · the current month is never deleted</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {Object.keys(KINDS).map((k) => (
              <MonthPanel key={`${k}-${selectedHotelId}`} kind={k} hotelId={selectedHotelId} hotelName={hotelName} params={period.params} periodKey={period.key} valid={period.valid} />
            ))}
          </div>

          <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <UserX className="w-5 h-5 text-ink-500 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-ink-900 dark:text-white">Old guests without bookings</p>
              <p className="text-ink-500 dark:text-ink-400">
                {data.unusedGuests ? `${data.unusedGuests} guest record(s) from earlier months have no bookings.` : 'None. Every guest record still has a booking.'}
              </p>
            </div>
            <button type="button" onClick={() => setConfirmGuests(true)} disabled={!data.unusedGuests || guestsMut.isPending} className="btn-danger !py-1.5 text-sm">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmGuests}
        title="Delete old guests?"
        message={`${data?.unusedGuests} guest record(s) with no bookings, and their uploaded ID files, will be permanently deleted. Income and expenses are not touched.`}
        confirmLabel="Delete permanently"
        loading={guestsMut.isPending}
        onConfirm={() => guestsMut.mutate()}
        onCancel={() => setConfirmGuests(false)}
      />
    </div>
  );
}
