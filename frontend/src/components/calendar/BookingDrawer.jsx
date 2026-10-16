import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Phone, BedDouble, CalendarDays, LogIn, LogOut, CreditCard, XCircle, ExternalLink } from 'lucide-react';
import OnlineTag from '../OnlineTag';
import toast from 'react-hot-toast';
import { checkinBooking, checkoutBooking, cancelBooking } from '../../api/services';
import { PaymentModal, CancelModal } from '../../pages/admin/BookingDetail';
import ConfirmDialog from '../ConfirmDialog';
import { formatDateTime } from '../../utils/date';
import { formatINR } from '../../utils/currency';
import { STATUS_BADGE } from './calendarUtils';

// Same keys the booking detail page refreshes, plus the calendar itself
const REFRESH_KEYS = ['calendar', 'bookings', 'booking', 'dashboard', 'rooms', 'inhouse', 'payments'];

/** Right-side drawer (bottom sheet on mobile) with a booking's summary and its actions. */
export default function BookingDrawer({ booking, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(null); // 'checkin' | 'checkout'
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !confirm && !paymentOpen && !cancelOpen && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, confirm, paymentOpen, cancelOpen]);

  const refresh = () => REFRESH_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

  const checkinMut = useMutation({
    mutationFn: () => checkinBooking(booking._id),
    onSuccess: () => { toast.success('Checked in!'); setConfirm(null); refresh(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Check-in failed'),
  });
  const checkoutMut = useMutation({
    mutationFn: () => checkoutBooking(booking._id),
    onSuccess: () => { toast.success('Checked out!'); setConfirm(null); refresh(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Check-out failed'),
  });
  const cancelMut = useMutation({
    mutationFn: (reason) => cancelBooking(booking._id, { reason }),
    onSuccess: () => { toast.success('Booking cancelled'); setCancelOpen(false); refresh(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Cancel failed'),
  });

  if (!booking) return null;
  const g = booking.guest || {};

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Booking ${booking.bookingNo}`}
        className="fixed z-50 inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[400px] md:max-h-none md:rounded-none flex flex-col bg-white dark:bg-ink-800 border-t md:border-t-0 md:border-l border-ink-200 dark:border-ink-700 shadow-2xl animate-modal-in"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-ink-100 dark:border-ink-700">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink-500 dark:text-ink-400">{booking.bookingNo}</p>
            <h2 className="text-lg font-semibold text-ink-900 dark:text-white truncate">{g.name || 'Guest'}</h2>
            <span className={`badge ${STATUS_BADGE[booking.status] || 'badge-slate'} mt-1`}>{booking.status}</span>
            {booking.source === 'Online' && <OnlineTag className="ml-2 mt-1" />}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 -m-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-100 dark:hover:bg-ink-700" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          {g.phone && (
            <a href={`tel:${g.phone}`} className="flex items-center gap-2 text-ink-700 dark:text-ink-200 hover:text-brand-600">
              <Phone className="w-4 h-4 text-ink-400" /> {g.phone}
            </a>
          )}
          <div className="flex items-start gap-2 text-ink-700 dark:text-ink-200">
            <BedDouble className="w-4 h-4 text-ink-400 mt-0.5" />
            <span>{booking.rooms.map((r) => `Room ${r.roomNumber}${r.type ? ` (${r.type})` : ''}`).join(', ')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-ink-50 dark:bg-ink-700/40 p-3">
              <p className="text-[11px] uppercase text-ink-500 dark:text-ink-400 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Check-in</p>
              <p className="font-medium text-ink-900 dark:text-white mt-0.5">{formatDateTime(booking.checkIn)}</p>
            </div>
            <div className="rounded-lg bg-ink-50 dark:bg-ink-700/40 p-3">
              <p className="text-[11px] uppercase text-ink-500 dark:text-ink-400 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Check-out</p>
              <p className="font-medium text-ink-900 dark:text-white mt-0.5">{formatDateTime(booking.checkOut)}</p>
            </div>
          </div>
          <div className="rounded-lg border border-ink-100 dark:border-ink-700 p-3 space-y-1.5">
            <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Nights</span><span>{booking.nights}</span></div>
            <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Amount</span><span className="font-medium">{formatINR(booking.grandTotal)}</span></div>
            <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Paid</span><span className="text-emerald-600">{formatINR(booking.paidAmount)}</span></div>
            <div className={`flex justify-between font-semibold ${booking.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              <span>Balance</span><span>{formatINR(booking.balance)}</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-ink-100 dark:border-ink-700 space-y-2">
          <button type="button" onClick={() => navigate(`/admin/bookings/${booking._id}`)} className="btn-secondary w-full justify-center">
            <ExternalLink className="w-4 h-4" /> View booking
          </button>
          {booking.status === 'Booked' && (
            <button type="button" onClick={() => setConfirm('checkin')} className="btn-primary w-full justify-center">
              <LogIn className="w-4 h-4" /> Check In
            </button>
          )}
          {booking.status === 'Checked-in' && (
            <button type="button" onClick={() => setConfirm('checkout')} className="btn-primary w-full justify-center">
              <LogOut className="w-4 h-4" /> Check Out
            </button>
          )}
          {booking.status !== 'Cancelled' && (
            <button type="button" onClick={() => setPaymentOpen(true)} className="btn-secondary w-full justify-center">
              <CreditCard className="w-4 h-4" /> Add Payment
            </button>
          )}
          {booking.status === 'Booked' && (
            <button type="button" onClick={() => setCancelOpen(true)} className="btn-danger w-full justify-center">
              <XCircle className="w-4 h-4" /> Cancel Booking
            </button>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={confirm === 'checkin'}
        danger={false}
        title="Check In"
        message={`Check in ${g.name || 'this guest'} to room ${booking.rooms.map((r) => r.roomNumber).join(', ')}?`}
        confirmLabel="Check In"
        onConfirm={() => checkinMut.mutate()}
        onCancel={() => setConfirm(null)}
        loading={checkinMut.isPending}
      />
      <ConfirmDialog
        open={confirm === 'checkout'}
        danger={false}
        title="Check Out"
        message={`Check out ${g.name || 'this guest'} from room ${booking.rooms.map((r) => r.roomNumber).join(', ')}?${booking.balance > 0 ? ` Balance due: ${formatINR(booking.balance)}.` : ''}`}
        confirmLabel="Check Out"
        onConfirm={() => checkoutMut.mutate()}
        onCancel={() => setConfirm(null)}
        loading={checkoutMut.isPending}
      />
      {paymentOpen && (
        <PaymentModal
          bookingId={booking._id}
          onClose={() => setPaymentOpen(false)}
          onSaved={() => { setPaymentOpen(false); refresh(); }}
        />
      )}
      {cancelOpen && (
        <CancelModal onClose={() => setCancelOpen(false)} onConfirm={(reason) => cancelMut.mutate(reason)} pending={cancelMut.isPending} />
      )}
    </>,
    document.body
  );
}
