import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { tokenRevoked, verifyToken } from '../middlewares/auth.js';
import { Admin, Hotel } from '../models/index.js';
import { corsOrigin } from '../config/cors.js';

let io = null;
let publicNs = null;

const hotelRoom = (hotelId) => `hotel:${hotelId}`;
const publicHotelRoom = (hotelId) => `public-hotel:${hotelId}`;

// Admin events after which public availability may have changed
const AVAILABILITY_EVENTS = new Set(['booking:created', 'booking:updated', 'room:updated']);

/** Accept "hotel:<id>" or a bare "<id>" from the client. */
const parseRoom = (value) => {
  const id = String(value || '').replace(/^hotel:/, '');
  return mongoose.isValidObjectId(id) && /^[0-9a-fA-F]{24}$/.test(id) ? id : null;
};

export function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  // Same JWT as the REST API: handshake.auth.token, or "Authorization: Bearer …"
  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.headers?.authorization || '';
      const token = socket.handshake.auth?.token || (header.startsWith('Bearer ') ? header.slice(7) : null);
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyToken(token);
      const admin = await Admin.findById(payload.sub).select('+passwordChangedAt');
      if (!admin) return next(new Error('Account no longer exists'));
      if (tokenRevoked(admin, payload)) return next(new Error('Password was changed, please log in again'));
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // Public namespace (no auth): guests on the booking page only ever get "availability:changed"
  publicNs = io.of('/public');
  publicNs.on('connection', (socket) => {
    socket.on('join', async (room, ack) => {
      const reply = (payload) => typeof ack === 'function' && ack(payload);
      try {
        const hotelId = parseRoom(String(room || '').replace(/^public-hotel:/, ''));
        const exists = hotelId && (await Hotel.exists({ _id: hotelId, isActive: true }));
        if (!exists) return reply({ ok: false, message: 'Unknown hotel' });
        // One hotel at a time per visitor
        for (const r of socket.rooms) if (r !== socket.id) socket.leave(r);
        await socket.join(publicHotelRoom(hotelId));
        reply({ ok: true });
      } catch (err) {
        console.error('[socket] public join failed:', err.message);
        reply({ ok: false, message: 'Could not join, try again' });
      }
    });
  });

  io.on('connection', (socket) => {
    const reply = (ack, payload) => typeof ack === 'function' && ack(payload);

    socket.on('join', async (room, ack) => {
      try {
        const hotelId = parseRoom(room);
        const exists = hotelId && (await Hotel.exists({ _id: hotelId }));
        if (!exists) return reply(ack, { ok: false, message: 'Unknown hotel' });
        await socket.join(hotelRoom(hotelId));
        reply(ack, { ok: true, room: hotelRoom(hotelId) });
      } catch (err) {
        console.error('[socket] join failed:', err.message);
        reply(ack, { ok: false, message: 'Could not join, try again' });
      }
    });

    socket.on('leave', async (room) => {
      try {
        const hotelId = parseRoom(room);
        if (hotelId) await socket.leave(hotelRoom(hotelId));
      } catch (err) {
        console.error('[socket] leave failed:', err.message);
      }
    });
  });

  return io;
}

/** Broadcast to everyone watching a hotel. Safe to call before sockets are initialised. */
export function emitToHotel(hotelId, event, payload) {
  if (!io || !hotelId) return;
  io.to(hotelRoom(String(hotelId))).emit(event, payload);
  if (publicNs && AVAILABILITY_EVENTS.has(event)) {
    // No personal data: just "look again"
    publicNs.to(publicHotelRoom(String(hotelId))).emit('availability:changed', { hotelId: String(hotelId) });
  }
}

export const getIO = () => io;
