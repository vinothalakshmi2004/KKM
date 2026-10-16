import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInhouseBookings, checkoutBooking } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { useNavigate } from 'react-router-dom';
import { formatDateTime, formatDate } from '../../utils/date';
import { formatINR } from '../../utils/currency';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Users, LogOut } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { formatRooms } from '../../utils/rooms';

export default function Inhouse() {
  const { selectedHotelId } = useHotel();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkingOut, setCheckingOut] = useState(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['inhouse', selectedHotelId],
    queryFn: () => getInhouseBookings(selectedHotelId).then((r) => r.data?.data || r.data || []),
    enabled: !!selectedHotelId,
    refetchInterval: 30000,
  });

  const checkoutMut = useMutation({
    mutationFn: (id) => checkoutBooking(id),
    onSuccess: () => {
      toast.success('Checked out!');
      setCheckingOut(null);
      ['inhouse', 'dashboard', 'bookings', 'rooms'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: () => toast.error('Check-out failed'),
  });

  if (!selectedHotelId) return <EmptyState title="No hotel selected" />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">In-House Guests</h1>
          <p className="text-sm text-ink-500 mt-0.5">{bookings.length} guest{bookings.length !== 1 ? 's' : ''} currently checked in</p>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : bookings.length === 0 ? (
        <EmptyState icon={Users} title="No guests checked in" description="All rooms are currently vacant." />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {bookings.map((b) => (
              <div key={b._id || b.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-white">{b.guestId?.name}</p>
                    <p className="text-sm text-ink-500">{b.guestId?.phone}</p>
                  </div>
                  <span className="badge badge-green">In-House</span>
                </div>
                <div className="mt-2 text-sm space-y-0.5 text-ink-500 dark:text-ink-400">
                  <p>Room: <strong>{formatRooms(b.rooms)}</strong></p>
                  <p>Check-in: {formatDateTime(b.checkIn)}</p>
                  <p>Expected Out: {formatDate(b.checkOut)}</p>
                  <p className={b.balance > 0 ? 'text-red-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                    Balance: {formatINR(b.balance || 0)}
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => navigate(`/admin/bookings/${b._id || b.id}`)} className="btn-secondary flex-1 text-xs">View</button>
                  <button onClick={() => setCheckingOut(b)} className="btn-primary flex-1 text-xs">
                    <LogOut className="w-3.5 h-3.5" /> Check Out
                  </button>
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
                  <th>Room</th>
                  <th>Check-in</th>
                  <th>Expected Check-out</th>
                  <th>Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b._id || b.id} className="cursor-pointer" onClick={() => navigate(`/admin/bookings/${b._id || b.id}`)}>
                    <td>
                      <p className="font-medium text-ink-900 dark:text-white">{b.guestId?.name}</p>
                      <p className="text-xs text-ink-400">{b.guestId?.phone}</p>
                    </td>
                    <td className="font-medium">{formatRooms(b.rooms)}</td>
                    <td>{formatDateTime(b.checkIn)}</td>
                    <td>{formatDate(b.checkOut)}</td>
                    <td className={b.balance > 0 ? 'text-red-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                      {formatINR(b.balance || 0)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setCheckingOut(b)}
                        className="btn-primary py-1.5 text-xs"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Check Out
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!checkingOut}
        title="Confirm Check-out"
        message={`Check out ${checkingOut?.guestId?.name} from Room ${(checkingOut?.rooms || []).map((r) => r.roomNumber || r).join(', ')}?`}
        onConfirm={() => checkoutMut.mutate(checkingOut._id || checkingOut.id)}
        loading={checkoutMut.isPending}
        onCancel={() => setCheckingOut(null)}
        danger={false}
      />
    </div>
  );
}
