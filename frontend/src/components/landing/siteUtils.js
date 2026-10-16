import { getGalleryImageUrl, getHotelCoverUrl } from '../../api/services';

/** Smooth-scroll to a section id (sections carry scroll-margin for the sticky navbar). */
export function scrollToSection(id) {
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Gallery images first, cover image as a fallback. Each: { src, caption }. */
export function hotelImages(hotel) {
  const gallery = (hotel?.gallery || []).map((g) => ({ src: getGalleryImageUrl(g._id), caption: g.caption || '' }));
  const cover = getHotelCoverUrl(hotel);
  if (cover) return [{ src: cover, caption: hotel.name }, ...gallery];
  return gallery;
}

export const fullAddress = (hotel) =>
  [hotel?.address, hotel?.area, hotel?.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');

/** Google Maps embed: the admin's embed URL, else coordinates, else the address. */
export function mapEmbedSrc(hotel) {
  const embed = (hotel?.mapEmbedUrl || '').trim();
  if (/^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i.test(embed)) return embed;
  if (hotel?.lat != null && hotel?.lng != null) return `https://maps.google.com/maps?q=${hotel.lat},${hotel.lng}&z=15&output=embed`;
  const address = fullAddress(hotel);
  return address ? `https://maps.google.com/maps?q=${encodeURIComponent(`${hotel.name}, ${address}`)}&z=15&output=embed` : null;
}

export function directionsUrl(hotel) {
  const destination = hotel?.lat != null && hotel?.lng != null ? `${hotel.lat},${hotel.lng}` : `${hotel?.name}, ${fullAddress(hotel)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export const waLink = (number, text) => {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

export const telLink = (phone) => (phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null);

/** Online booking page, optionally pre-filled: /book/:slug?checkIn=YYYY-MM-DD&checkOut=…&adults=…&roomType=… */
export function bookingHref(slug, prefill = {}) {
  const params = new URLSearchParams();
  if (prefill.checkIn) params.set('checkIn', prefill.checkIn);
  if (prefill.checkOut) params.set('checkOut', prefill.checkOut);
  if (prefill.guests) params.set('adults', String(prefill.guests));
  if (prefill.rooms) params.set('rooms', String(prefill.rooms));
  if (prefill.roomType) params.set('roomType', prefill.roomType);
  const qs = params.toString();
  return `/book${slug ? `/${slug}` : ''}${qs ? `?${qs}` : ''}`;
}
