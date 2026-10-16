import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, CheckCircle2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { dataOf, getBookingsByMonth } from '../api/services';
import { downloadCSV } from '../utils/csv';
import { bookingRows as toRows } from '../utils/monthExports';
import { dayjs, TZ } from '../utils/date';

const thisMonth = () => dayjs().tz(TZ).format('YYYY-MM');
const lastMonth = () => dayjs().tz(TZ).subtract(1, 'month').format('YYYY-MM');

/** Bookings page: export one month's bookings as CSV (deleting is done in Settings → Data & Storage). */
export default function BookingExportModal({ hotelId, hotelName = 'hotel', initialMonth, onClose }) {
  const [month, setMonth] = useState(initialMonth || lastMonth());
  const [exported, setExported] = useState(new Set()); // months downloaded in this window

  const { data, isFetching, isError } = useQuery({
    queryKey: ['bookings-by-month', hotelId, month],
    queryFn: () => getBookingsByMonth({ hotelId, month }).then(dataOf),
    enabled: !!month && month <= thisMonth(),
  });

  const download = () => {
    if (!data) return;
    const safeName = hotelName.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    downloadCSV(`bookings-${safeName}-${month}.csv`, toRows(data.items));
    setExported((s) => new Set(s).add(month));
    toast.success(`${data.total} booking(s) from ${data.label} downloaded`);
  };

  const wasExported = exported.has(month);

  return (
    <Modal
      title="Export Bookings"
      subtitle="Download one month's bookings with guest details as a CSV file."
      icon={Download}
      size="md"
      onClose={onClose}
      footer={<button type="button" onClick={onClose} className="btn-secondary">Close</button>}
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="export-month">Month (by check-in date)</label>
          <input id="export-month" type="month" className="input" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </div>

        <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-4 text-sm">
          {isError ? (
            <p className="text-red-500">Could not load this month. Please try again.</p>
          ) : !data || isFetching ? (
            <p className="text-ink-500 dark:text-ink-400">Loading…</p>
          ) : (
            <p className="font-semibold text-ink-900 dark:text-white">{data.label}: {data.total} booking{data.total === 1 ? '' : 's'}</p>
          )}
        </div>

        <button type="button" onClick={download} disabled={!data || isFetching || !data.total} className="btn-primary w-full justify-center">
          {wasExported ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          {wasExported ? 'Downloaded · download again' : 'Download CSV'}
        </button>

        <p className="text-xs text-ink-500 dark:text-ink-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          To delete old months from the database, use Settings → Data &amp; Storage.
        </p>
      </div>
    </Modal>
  );
}
