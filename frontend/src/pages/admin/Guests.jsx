import { useState, useEffect, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { getGuests, exportGuestsCsv } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { Search, Users, Download, X, Calendar, Loader2 } from 'lucide-react';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import toast from 'react-hot-toast';
import ScreenOverlay from '../../components/ScreenOverlay';

// ---------------------------------------------------------------------------
// Export Modal
// ---------------------------------------------------------------------------
function ExportModal({ hotelId, onClose }) {
  const [mode, setMode] = useState('all'); // 'all' | 'range'
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const backdropRef = useRef(null);

  const handleExport = async () => {
    if (mode === 'range' && !from && !to) {
      toast.error('Please select at least one date.');
      return;
    }
    if (mode === 'range' && from && to && from > to) {
      toast.error('"From" date cannot be after "To" date.');
      return;
    }

    setLoading(true);
    try {
      const params = { hotelId };
      if (mode === 'range') {
        if (from) params.from = from;
        if (to) params.to = to;
      }

      const res = await exportGuestsCsv(params);

      // Trigger browser download
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guests_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success('Guest data exported successfully!');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenOverlay>
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white dark:bg-ink-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100 dark:border-ink-700">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-brand-600" />
            <h2 className="text-base font-semibold text-ink-900 dark:text-white">Export Guest Data</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Mode toggle */}
          <div className="flex gap-3">
            <button
              onClick={() => setMode('all')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                mode === 'all'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'border-ink-200 dark:border-ink-600 text-ink-600 dark:text-ink-400 hover:border-ink-300 dark:hover:border-ink-500'
              }`}
            >
              All Data
            </button>
            <button
              onClick={() => setMode('range')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border-2 transition-all duration-200 flex items-center justify-center gap-2 ${
                mode === 'range'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'border-ink-200 dark:border-ink-600 text-ink-600 dark:text-ink-400 hover:border-ink-300 dark:hover:border-ink-500'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Date Range
            </button>
          </div>

          {/* Date inputs */}
          {mode === 'range' && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              <div>
                <label className="label">From</label>
                <input
                  type="date"
                  className="input"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="label">To</label>
                <input
                  type="date"
                  className="input"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-ink-500 dark:text-ink-400 bg-ink-50 dark:bg-ink-700/40 rounded-lg px-3 py-2">
            {mode === 'all'
              ? 'All guests for the selected hotel will be exported as a CSV file.'
              : 'Guests added between the selected dates will be exported. Leave a date empty to export with no lower/upper bound.'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-ink-100 dark:border-ink-700">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
            Cancel
          </button>
          <button onClick={handleExport} className="btn-primary flex-1 gap-2" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </ScreenOverlay>
  );
}

// ---------------------------------------------------------------------------
// Guests Page
// ---------------------------------------------------------------------------
export default function Guests() {
  const { selectedHotelId } = useHotel();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showExport, setShowExport] = useState(false);

  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ['guests', selectedHotelId, debouncedSearch, page],
    queryFn: () =>
      getGuests({ hotelId: selectedHotelId, search: debouncedSearch, page, limit: 20 })
        .then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
    placeholderData: keepPreviousData,
  });

  const guests = data?.items || data || [];
  const pages = data?.pages ?? Math.max(1, Math.ceil((data?.total || 0) / 20));

  useEffect(() => setPage(1), [selectedHotelId]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  if (!selectedHotelId) return <EmptyState title="No hotel selected" description="Select a hotel from the top bar." />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Guests</h1>
        <button
          id="export-guests-btn"
          onClick={() => setShowExport(true)}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="card mb-5">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : guests.length === 0 ? (
        <EmptyState icon={Users} title="No guests found" description="Guests are added automatically when you create bookings." />
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {guests.map((g) => (
              <div key={g._id || g.id} onClick={() => navigate(`/admin/guests/${g._id || g.id}`)} className="card cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold">
                    {g.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-white">{g.name}</p>
                    <p className="text-sm text-ink-500">{g.phone} · {g.bookingCount || 0} booking{g.bookingCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block table-container">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Email</th><th>ID Proof</th><th>Bookings</th></tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g._id || g.id} onClick={() => navigate(`/admin/guests/${g._id || g.id}`)} className="cursor-pointer">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-400 font-bold text-xs">
                          {g.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-ink-900 dark:text-white">{g.name}</span>
                      </div>
                    </td>
                    <td>{g.phone}</td>
                    <td className="text-ink-500">{g.email || '—'}</td>
                    <td>{g.idProofType ? `${g.idProofType}: ${g.idProofNumber}` : '—'}</td>
                    <td><span className="badge badge-blue">{g.bookingCount || 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </>
      )}

      {showExport && (
        <ExportModal hotelId={selectedHotelId} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
