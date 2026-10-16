import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, FileText } from 'lucide-react';
import { getInvoices } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { useDebounce } from '../../hooks/useDebounce';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { formatDate } from '../../utils/date';
import { formatINR } from '../../utils/currency';

// Existing status badge colours: Issued = Checked-in colour, Cancelled = Cancelled colour
export const INVOICE_BADGE = { Issued: 'badge-green', Cancelled: 'badge-red' };

export default function Invoices() {
  const { selectedHotelId } = useHotel();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' });
  const search = useDebounce(filters.search);
  const query = { ...filters, search };

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', selectedHotelId, page, query],
    queryFn: () => getInvoices({ hotelId: selectedHotelId, page, limit: 20, ...query }).then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
    placeholderData: keepPreviousData,
  });

  const invoices = data?.items || [];
  const pages = data?.pages ?? 1;

  useEffect(() => setPage(1), [selectedHotelId]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const setFilter = (key, val) => { setFilters((f) => ({ ...f, [key]: val })); setPage(1); };

  if (!selectedHotelId) {
    return <EmptyState title="No hotel selected" description="Select a hotel from the top bar." />;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Generate an invoice from a booking's page.</p>
        </div>
        {data && (
          <div className="text-right">
            <p className="text-xs text-ink-500 dark:text-ink-400">Total issued{Object.values(filters).some(Boolean) ? ' (filtered)' : ''}</p>
            <p className="text-xl font-bold text-ink-900 dark:text-white">{formatINR(data.totalIssued)}</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search invoice no, guest, phone or booking…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          <select className="input w-auto" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All Status</option>
            <option>Issued</option>
            <option>Cancelled</option>
          </select>
          <input type="date" className="input w-auto" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="From date" />
          <input type="date" className="input w-auto" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="To date" />
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => { setFilters({ search: '', status: '', from: '', to: '' }); setPage(1); }} className="btn-ghost text-sm">
              Clear
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices found"
          description="Open a booking and click “Generate invoice” to create one."
          action={() => navigate('/admin/bookings')}
          actionLabel="Go to Bookings"
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {invoices.map((inv) => (
              <div key={inv._id} onClick={() => navigate(`/admin/invoices/${inv._id}`)} className="card cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-white">{inv.invoiceNo}</p>
                    <p className="text-sm text-ink-500">{inv.guest?.name}</p>
                  </div>
                  <span className={`badge ${INVOICE_BADGE[inv.status] || 'badge-slate'}`}>{inv.status}</span>
                </div>
                <div className="mt-2 text-sm text-ink-500 dark:text-ink-400 space-y-0.5">
                  <p>{formatDate(inv.issuedAt)} · {inv.stay?.bookingNo}</p>
                  <p className="font-semibold text-ink-700 dark:text-ink-300">{formatINR(inv.grandTotal)} · Bal: {formatINR(inv.balance)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Guest</th>
                  <th>Booking</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id} onClick={() => navigate(`/admin/invoices/${inv._id}`)} className="cursor-pointer">
                    <td className="font-medium text-ink-900 dark:text-white">{inv.invoiceNo}</td>
                    <td>
                      <p className="font-medium text-ink-900 dark:text-white">{inv.guest?.name || '—'}</p>
                      <p className="text-xs text-ink-400">{inv.guest?.phone}</p>
                    </td>
                    <td>{inv.stay?.bookingNo}</td>
                    <td>{formatDate(inv.issuedAt)}</td>
                    <td className="font-medium">{formatINR(inv.grandTotal)}</td>
                    <td className={inv.balance > 0 ? 'text-red-500 font-medium' : 'text-emerald-500 font-medium'}>{formatINR(inv.balance)}</td>
                    <td><span className={`badge ${INVOICE_BADGE[inv.status] || 'badge-slate'}`}>{inv.status}</span></td>
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
