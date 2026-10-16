import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const HotelContext = createContext(null);

export function HotelProvider({ children }) {
  const [selectedHotelId, setSelectedHotelId] = useState(
    () => localStorage.getItem('selectedHotelId') || null
  );
  const [hotels, setHotels] = useState([]);

  useEffect(() => {
    if (selectedHotelId) {
      localStorage.setItem('selectedHotelId', selectedHotelId);
    }
  }, [selectedHotelId]);

  const selectHotel = useCallback((id) => {
    setSelectedHotelId(id);
    localStorage.setItem('selectedHotelId', id);
  }, []);

  const clearHotel = useCallback(() => {
    setSelectedHotelId(null);
    setHotels([]);
    localStorage.removeItem('selectedHotelId');
  }, []);

  return (
    <HotelContext.Provider value={{ selectedHotelId, selectHotel, clearHotel, hotels, setHotels }}>
      {children}
    </HotelContext.Provider>
  );
}

export const useHotel = () => useContext(HotelContext);
