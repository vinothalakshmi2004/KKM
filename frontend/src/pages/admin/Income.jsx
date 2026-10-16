import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getPayments, fetchAllPages } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { formatDate, now } from '../../utils/date';
import { formatINR } from '../../utils/currency';
import { downloadCSV } from '../../utils/csv';
import toast from 'react-hot-toast';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { TrendingUp, Download } from 'lucide-react';
import { paymentKind } from '../../utils/paymentStatus';

// IST calendar dates, so "Today" is right between 00:00 and 05:30
const today = () => now().format('YYYY-MM-DD');
const PRESETS = [
  { label: 'Today', from: today, to: today },
  { label: 'This Week', from: () => now().startOf('week').format('YYYY-MM-DD'), to: today },
  { label: 'This Month', from: () => now().startOf('month').format('YYYY-MM-DD'), to: today },
  { label: 'This Year', from: () => now().startOf('year').format('YYYY-MM-DD'), to: today },
];

export default function Income() {
  const { selectedHotelId } = useHotel();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['payments', selectedHotelId, from, to, page],
    queryFn: () =>
      getPayments({ hotelId: selectedHotelId, from: from || undefined, to: to || undefined, page, limit: 20 })
        .then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
  });

  useEffect(() => setPage(1), [selectedHotelId, from, to]);

  const payments = data?.items || data || [];
  const pages = data?.pages ?? Math.max(1, Math.ceil((data?.total || 0) / 20));
  // Totals from the server cover every matching payment, not just this page
  const total = data?.totals?.amount || 0;

  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const modeBreakdown = Object.fromEntries((data?.totals?.byMode || []).map((m) => [m.mode, m.amount]));

  const [exporting, setExporting] = useState(false);
  const exportCSV = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages(getPayments, { hotelId: selectedHotelId, from: from || undefined, to: to || undefined });
      const rows = [['Date', 'Booking', 'Guest', 'Phone', 'Amount', 'Mode', 'Note']];
      all.forEach((p) => rows.push([formatDate(p.date), p.bookingId?.bookingNo || p.bookingNo || '', p.bookingId?.guestId?.name || p.guestName || '', p.bookingId?.guestId?.phone || p.guestPhone || '', p.amount, p.mode, p.note || '']));
      downloadCSV('income.csv', rows);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!selectedHotelId) return <EmptyState title="No hotel selected" />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Income</h1>
        <button onClick={exportCSV} disabled={exporting} className="btn-secondary"><Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export CSV'}</button>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setFrom(p.from()); setTo(p.to()); setPage(1); }}
              className="btn-secondary text-xs py-1.5"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-400">
            <input type="date" className="input w-auto" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <span>to</span>
            <input type="date" className="input w-auto" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo(''); }} className="btn-ghost text-sm">Clear</button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div className="card col-span-2 sm:col-span-1">
          <p className="text-sm text-ink-500">Total</p>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{formatINR(total)}</p>
        </div>
        {Object.entries(modeBreakdown).map(([mode, amt]) => (
          <div key={mode} className="card">
            <p className="text-sm text-ink-500">{mode}</p>
            <p className="text-xl font-bold text-ink-900 dark:text-white">{formatINR(amt)}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : payments.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No payments found" description="Payments are recorded when you add them to bookings." />
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Guest</th><th>Booking</th><th>Amount</th><th>Mode</th><th>Note</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id || p.id}>
                    <td>{formatDate(p.date)}</td>
                    <td>
                      <p className="font-medium text-ink-900 dark:text-white">{p.bookingId?.guestId?.name || p.guestName || '—'}</p>
                      {(p.bookingId?.guestId?.phone || p.guestPhone) && (
                        <a href={`tel:${p.bookingId?.guestId?.phone || p.guestPhone}`} className="text-xs text-ink-400 hover:underline">{p.bookingId?.guestId?.phone || p.guestPhone}</a>
                      )}
                    </td>
                    <td className="text-xs">
                      {p.bookingId ? (
                        <button onClick={() => navigate(`/admin/bookings/${p.bookingId._id}`)} className="text-brand-600 hover:underline">{p.bookingId.bookingNo}</button>
                      ) : (p.bookingNo || '—')}
                    </td>
                    <td className="font-semibold text-emerald-600 dark:text-emerald-400">{formatINR(p.amount)}</td>
                    <td><span className="badge badge-slate">{p.mode}</span></td>
                    <td>
                      {paymentKind(p.note) ? (
                        <span className={`badge ${paymentKind(p.note).badge}`}>{paymentKind(p.note).label}</span>
                      ) : (
                        <span className="text-ink-500">{p.note || '—'}</span>
                      )}
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
