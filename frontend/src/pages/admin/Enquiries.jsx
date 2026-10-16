import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEnquiries, updateEnquiry } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../utils/date';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { MessageSquare, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['New', 'Contacted', 'Converted', 'Closed'];
const STATUS_BADGE = {
  New: 'badge-blue',
  Contacted: 'badge-yellow',
  Converted: 'badge-green',
  Closed: 'badge-slate',
};

export default function Enquiries() {
  const { selectedHotelId } = useHotel();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => setPage(1), [selectedHotelId, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['enquiries', selectedHotelId, statusFilter, page],
    queryFn: () =>
      getEnquiries({ hotelId: selectedHotelId, status: statusFilter, page, limit: 20 })
        .then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
  });

  const enquiries = data?.items || data || [];
  const pages = data?.pages ?? Math.max(1, Math.ceil((data?.total || 0) / 20));

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateEnquiry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  const handleConvert = (enquiry) => {
    const e = enquiry;
    navigate('/admin/bookings/new', {
      state: {
        prefill: {
          enquiryId: e._id || e.id,
          name: e.name,
          phone: e.phone,
          checkIn: e.checkIn,
          checkOut: e.checkOut,
          roomType: e.roomType,
          guests: e.guests,
        },
      },
    });
  };

  if (!selectedHotelId) return <EmptyState title="No hotel selected" />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">WhatsApp Enquiries</h1>
      </div>

      <div className="card mb-5">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={statusFilter === '' ? 'btn-primary py-1.5 text-xs' : 'btn-secondary py-1.5 text-xs'}
          >
            All
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? 'btn-primary py-1.5 text-xs' : 'btn-secondary py-1.5 text-xs'}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : enquiries.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No enquiries" description="Enquiries from your public hotel page will appear here." />
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {enquiries.map((e) => (
              <div key={e._id || e.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-white">{e.name}</p>
                    <p className="text-sm text-ink-500">{e.phone} · {e.guests} guests</p>
                    <p className="text-xs text-ink-400 mt-0.5">{formatDateTime(e.createdAt)}</p>
                  </div>
                  <span className={`badge ${STATUS_BADGE[e.status] || 'badge-slate'}`}>{e.status}</span>
                </div>
                {e.message && <p className="text-xs text-ink-500 mt-2 italic">"{e.message}"</p>}
                <div className="flex gap-2 mt-3">
                  <select
                    className="input text-xs flex-1"
                    value={e.status}
                    onChange={(ev) => updateMut.mutate({ id: e._id || e.id, data: { status: ev.target.value } })}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {!['Converted', 'Closed'].includes(e.status) && (
                    <button onClick={() => handleConvert(e)} className="btn-primary text-xs py-1.5">
                      Convert <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block table-container">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Check-in</th><th>Check-out</th><th>Guests</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {enquiries.map((e) => (
                  <tr key={e._id || e.id}>
                    <td>
                      <p className="font-medium text-ink-900 dark:text-white">{e.name}</p>
                      {e.message && <p className="text-xs text-ink-400 italic max-w-[10rem] truncate">"{e.message}"</p>}
                    </td>
                    <td>{e.phone}</td>
                    <td>{e.checkIn ? new Date(e.checkIn).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{e.checkOut ? new Date(e.checkOut).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{e.guests || '—'}</td>
                    <td>
                      <select
                        className="input text-xs py-1 w-32"
                        value={e.status || 'New'}
                        onChange={(ev) => updateMut.mutate({ id: e._id || e.id, data: { status: ev.target.value } })}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      {!['Converted', 'Closed'].includes(e.status) && (
                        <button onClick={() => handleConvert(e)} className="btn-primary py-1 text-xs">
                          Convert to Booking
                        </button>
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
