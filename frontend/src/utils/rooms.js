/** "101 (AC), 102 (Non-AC)" from a booking's rooms */
export const formatRooms = (rooms = []) =>
  rooms.map((r) => (r.type ? `${r.roomNumber} (${r.type})` : r.roomNumber || r)).join(', ');
