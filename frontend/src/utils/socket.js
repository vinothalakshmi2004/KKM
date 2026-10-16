import { io } from 'socket.io-client';
import { SOCKET_URL } from './apiUrl';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem('token') },
      autoConnect: false,
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  // Refresh the token each time: the user may have logged out and back in
  s.auth = { token: localStorage.getItem('token') };
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};

export const joinHotelRoom = (hotelId) => {
  const s = getSocket();
  s.emit('join', `hotel:${hotelId}`);
};

export const leaveHotelRoom = (hotelId) => {
  const s = getSocket();
  s.emit('leave', `hotel:${hotelId}`);
};
