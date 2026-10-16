import { io } from 'socket.io-client';
import { SOCKET_URL } from './apiUrl';

// Guest-facing socket: no login, "/public" namespace, only "availability:changed" events
let socket = null;

export function getPublicSocket() {
  if (!socket) socket = io(`${SOCKET_URL}/public`, { autoConnect: true });
  return socket;
}

/** Listen for availability changes of one hotel. Returns an unsubscribe function. */
export function watchAvailability(hotelId, onChange) {
  const s = getPublicSocket();
  const join = () => s.emit('join', hotelId);
  if (s.connected) join();
  s.on('connect', join); // also re-joins after a reconnect
  s.on('availability:changed', onChange);
  return () => {
    s.off('connect', join);
    s.off('availability:changed', onChange);
  };
}
