import {
  Wifi, Tv, Snowflake, Flame, ShowerHead, Bath, Shirt, Fan, Car, Coffee, Utensils, Sunrise, Refrigerator,
  Droplets, Lock, Armchair, Sparkles,
} from 'lucide-react';

// Icon + short neutral description for common amenity names (matched case-insensitively).
const CATALOG = [
  { match: /wi-?fi|internet/i, icon: Wifi, text: 'Wireless internet access' },
  { match: /^ac$|air ?con/i, icon: Snowflake, text: 'Air-conditioned rooms available' },
  { match: /tv|television/i, icon: Tv, text: 'Television in the room' },
  { match: /geyser|hot ?water/i, icon: Flame, text: 'Hot water supply' },
  { match: /shower/i, icon: ShowerHead, text: 'Shower in the bathroom' },
  { match: /bath|toilet|washroom/i, icon: Bath, text: 'Attached private bathroom' },
  { match: /wardrobe|cupboard|closet/i, icon: Shirt, text: 'Wardrobe for your belongings' },
  { match: /fan/i, icon: Fan, text: 'Ceiling fan' },
  { match: /parking/i, icon: Car, text: 'Parking available' },
  { match: /coffee|tea/i, icon: Coffee, text: 'Tea / coffee' },
  { match: /restaurant|dining|food/i, icon: Utensils, text: 'Dining available' },
  { match: /balcony|view/i, icon: Sunrise, text: 'Balcony' },
  { match: /fridge|refrigerator/i, icon: Refrigerator, text: 'Refrigerator' },
  { match: /water/i, icon: Droplets, text: 'Drinking water' },
  { match: /locker|safe/i, icon: Lock, text: 'Safe locker' },
  { match: /sofa|seating|chair/i, icon: Armchair, text: 'Seating area' },
];

export function amenityInfo(name) {
  const hit = CATALOG.find((c) => c.match.test(name.trim()));
  return { name, icon: hit?.icon || Sparkles, text: hit?.text || '' };
}

/** Unique amenities across the hotel's room types (case-insensitive), most common first. */
export function hotelAmenities(hotel) {
  const seen = new Map();
  for (const rt of hotel?.roomTypes || []) {
    for (const a of rt.amenities || []) {
      const key = a.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, a.trim());
    }
  }
  return [...seen.values()].map(amenityInfo);
}
