import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, joinHotelRoom, leaveHotelRoom } from '../utils/socket';
import toast from 'react-hot-toast';
import { playNotificationSound } from '../utils/notifySound';
import { formatDateTime } from '../utils/date';

export function useSocket(hotelId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!hotelId) return;

    const socket = connectSocket();
    joinHotelRoom(hotelId);

    const invalidate = (keys) => {
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    };

    socket.on('booking:created', () => invalidate(['bookings', 'dashboard', 'rooms', 'calendar', 'online-bookings']));
    socket.on('booking:updated', () => invalidate(['bookings', 'dashboard', 'rooms', 'inhouse', 'calendar', 'online-bookings']));
    socket.on('online-booking:created', (e) => {
      invalidate(['online-bookings', 'online-unseen', 'bookings', 'calendar']);
      playNotificationSound();
      const rooms = (e?.roomNumbers || []).join(', ');
      toast.success(
        `New online booking ${e?.onlineRef || ''}\n${e?.guestName || 'Guest'} · Room ${rooms}\nCheck-in ${formatDateTime(e?.checkIn)}`,
        { icon: '🛎️', duration: 8000, id: `ob-${e?.bookingId}` }
      );
    });
    socket.on('online-booking:seen', () => invalidate(['online-bookings', 'online-unseen']));
    socket.on('employee:updated', () => invalidate(['employees']));
    socket.on('room:updated', () => invalidate(['rooms', 'dashboard', 'calendar']));
    socket.on('payment:created', () => invalidate(['payments', 'bookings', 'dashboard', 'calendar']));
    socket.on('expense:created', () => invalidate(['expenses', 'dashboard']));
    socket.on('invoice:created', () => invalidate(['invoices', 'invoice', 'booking-invoice']));
    socket.on('invoice:updated', () => invalidate(['invoices', 'invoice', 'booking-invoice']));
    socket.on('enquiry:created', () => {
      invalidate(['enquiries']);
      toast('📩 New enquiry received!', { icon: '🔔' });
    });

    return () => {
      leaveHotelRoom(hotelId);
      socket.off('booking:created');
      socket.off('booking:updated');
      socket.off('online-booking:created');
      socket.off('online-booking:seen');
      socket.off('employee:updated');
      socket.off('room:updated');
      socket.off('payment:created');
      socket.off('expense:created');
      socket.off('invoice:created');
      socket.off('invoice:updated');
      socket.off('enquiry:created');
    };
  }, [hotelId, queryClient]);
}
