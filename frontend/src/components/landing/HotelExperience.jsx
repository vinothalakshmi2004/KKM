import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin, Phone, Mail, Clock, BedDouble, Users, Navigation, MessageCircle, ArrowRight, Snowflake, Fan,
  ZoomIn, ChevronLeft, CalendarDays, Building2, Sparkles, ChevronDown,
} from 'lucide-react';
import Lightbox from '../Lightbox';
import GoldBubbles from '../GoldBubbles';
import { formatINR } from '../../utils/currency';
import { formatClock } from '../../utils/date';
import Navbar from './Navbar';
import HeroSearch from './HeroSearch';
import SectionHeading from './SectionHeading';
import EnquiryDialog from './EnquiryDialog';
import EnquiryForm from './EnquiryForm';
import Footer from './Footer';
import BackToTop from './BackToTop';
import { hotelAmenities } from './amenities';
import { useReveal } from './useReveal';
import { bookingHref, directionsUrl, fullAddress, hotelImages, mapEmbedSrc, scrollToSection, telLink, waLink } from './siteUtils';

/** Image with a branded placeholder when the hotel has no photos yet. */
function Photo({ src, alt, className = '', children }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-night-700 via-night-800 to-night ${className}`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="img-zoom absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gold-300/70">
          <Building2 className="w-10 h-10" />
          <span className="mt-2 text-[11px] tracking-[0.2em] uppercase">Photo coming soon</span>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The full single-hotel experience: hero, about, rooms, amenities, gallery, location, contact.
 * Used for /hotel/:slug and for the landing page when only one hotel is active.
 * Sections without data are left out (and so are their navbar links).
 */
export default function HotelExperience({ hotel, backToHotels = false }) {
  const images = useMemo(() => hotelImages(hotel), [hotel]);
  const gallery = useMemo(() => images.filter((img, i) => !(i === 0 && img.src.includes('/cover'))), [images]);
  const amenities = useMemo(() => hotelAmenities(hotel), [hotel]);
  const roomTypes = hotel.roomTypes || [];
  const totalRooms = roomTypes[0]?.rooms || 0;
  const address = fullAddress(hotel);
  const mapSrc = mapEmbedSrc(hotel);

  const [enquiry, setEnquiry] = useState({ open: false, prefill: {} });
  const [lightbox, setLightbox] = useState(null);
  const [openRoom, setOpenRoom] = useState(null);

  const hotels = useMemo(() => [{ slug: hotel.slug, name: hotel.name, whatsappNumber: hotel.whatsappNumber }], [hotel]);
  const navigate = useNavigate();
  const online = hotel.onlineBookingEnabled !== false;
  // Book Now: the online booking page; the WhatsApp enquiry form when the hotel has online booking off
  const book = useCallback(
    (prefill = {}) => (online ? navigate(bookingHref(hotel.slug, prefill)) : setEnquiry({ open: true, prefill: { hotelSlug: hotel.slug, ...prefill } })),
    [hotel.slug, online, navigate]
  );
  const closeEnquiry = useCallback(() => setEnquiry((e) => ({ ...e, open: false })), []);

  const links = useMemo(
    () =>
      [
        { id: 'top', label: 'Home' },
        roomTypes.length && { id: 'rooms', label: 'Rooms & Suites' },
        amenities.length && { id: 'amenities', label: 'Amenities' },
        gallery.length && { id: 'gallery', label: 'Gallery' },
        (mapSrc || address) && { id: 'location', label: 'Location' },
        { id: 'contact', label: 'Contact Us' },
      ].filter(Boolean),
    [roomTypes.length, amenities.length, gallery.length, mapSrc, address]
  );

  useReveal([hotel._id, links.length]);

  const heroImage = images[0]?.src;
  const lowest = hotel.startingPrice;
  // First sentence of the description (no regex lookbehind: older Safari can't parse it)
  const tagline = hotel.description?.trim().match(/^[^.!?\r\n]*[.!?]?/)?.[0] ||`Comfortable rooms${hotel.area || hotel.city ? ` in ${hotel.area || hotel.city}` : ''}, with AC and Non-AC options.`;

  const highlights = [
    hotel.checkInTime && { icon: Clock, label: 'Check-in', value: formatClock(hotel.checkInTime) },
    hotel.checkOutTime && { icon: Clock, label: 'Check-out', value: formatClock(hotel.checkOutTime) },
    totalRooms > 0 && { icon: BedDouble, label: 'Rooms', value: `${totalRooms} rooms` },
    lowest != null && { icon: Sparkles, label: 'Rooms from', value: `${formatINR(lowest)} / night` },
    roomTypes.length > 1 && { icon: Snowflake, label: 'Choice', value: 'AC & Non-AC' },
    (hotel.area || hotel.city) && { icon: MapPin, label: 'Location', value: [hotel.area, hotel.city].filter(Boolean).join(', ') },
  ].filter(Boolean);

  return (
    <div className="site min-h-screen">
      <Navbar brand={hotel.name} subtitle={hotel.city || hotel.area} links={links} onBook={() => book()} />

      {/* ------------------------------------------------------------------ Hero */}
      <section id="top" className="site-section relative min-h-[100svh] flex items-end">
        <Photo src={heroImage} alt={hotel.name} className="!absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/40 to-night/90" />
        <GoldBubbles className="absolute inset-0 w-full h-full" />
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-12 sm:pb-16">
          {backToHotels && (
            <Link to="/" className="reveal inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white mb-6">
              <ChevronLeft className="w-4 h-4" /> All hotels
            </Link>
          )}
          <p className="reveal text-xs sm:text-sm font-semibold tracking-[0.3em] uppercase text-gold-300">
            {[hotel.area, hotel.city].filter(Boolean).join(' · ') || 'Welcome'}
          </p>
          <h1 className="reveal reveal-delay-1 font-display text-4xl sm:text-6xl lg:text-7xl text-white mt-4 max-w-4xl leading-[1.05]">
            {hotel.name}
          </h1>
          <p className="reveal reveal-delay-2 mt-5 text-base sm:text-xl text-white/85 max-w-2xl leading-relaxed">{tagline}</p>
          <div className="reveal reveal-delay-2 mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => book()} className="btn-gold">
              <CalendarDays className="w-4 h-4" /> Book Now
            </button>
            {roomTypes.length > 0 && (
              <button type="button" onClick={() => scrollToSection('rooms')} className="btn-ghost-light">
                Explore Rooms <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {lowest != null && (
              <span className="self-center text-sm text-white/80 ml-1">
                Rooms from <span className="text-gold-300 font-semibold">{formatINR(lowest)}</span> / night
              </span>
            )}
          </div>
          <div className="reveal reveal-delay-3 mt-10">
            <HeroSearch hotels={hotels} onSearch={(values) => book(values)} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ About */}
      <section id="about" className="site-section py-20 sm:py-28 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-14 items-center">
          <div className="reveal grid grid-cols-2 gap-4">
            <Photo src={images[1]?.src || images[0]?.src} alt={hotel.name} className="group col-span-2 h-64 sm:h-80 rounded-3xl shadow-xl" />
            <Photo src={images[2]?.src} alt="" className="group h-40 sm:h-52 rounded-3xl shadow-lg" />
            <div className="h-40 sm:h-52 rounded-3xl bg-night text-white p-5 flex flex-col justify-between shadow-lg">
              <p className="text-[11px] tracking-[0.25em] uppercase text-gold-300">Stay with us</p>
              <div>
                {lowest != null ? (
                  <>
                    <p className="font-display text-3xl">{formatINR(lowest)}</p>
                    <p className="text-sm text-white/70">per night, onwards</p>
                  </>
                ) : (
                  <p className="font-display text-2xl">Rates on request</p>
                )}
              </div>
            </div>
          </div>
          <div>
            <SectionHeading align="left" eyebrow="About the hotel" title={`Welcome to ${hotel.name}`} />
            <div className="reveal space-y-4 text-ink-soft text-base sm:text-lg leading-relaxed -mt-4">
              {hotel.description ? (
                hotel.description.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p>
                  {hotel.name}
                  {address ? ` is located at ${address}.` : '.'} Choose an AC or Non-AC room and send us your dates. We'll confirm
                  availability on WhatsApp.
                </p>
              )}
            </div>
            {highlights.length > 0 && (
              <dl className="reveal mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {highlights.map((h) => (
                  <div key={h.label} className="rounded-2xl bg-white border border-cream-100 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <h.icon className="w-5 h-5 text-gold-600" />
                    <dt className="mt-2 text-[11px] uppercase tracking-wider text-ink-soft">{h.label}</dt>
                    <dd className="font-semibold text-ink">{h.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ Rooms & Suites */}
      {roomTypes.length > 0 && (
        <section id="rooms" className="site-section py-20 sm:py-28 bg-white relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
            <SectionHeading
              eyebrow="Rooms & Suites"
              title="Choose your comfort"
              intro={`${totalRooms ? `${totalRooms} rooms, ` : ''}each available as AC or Non-AC. Pick the one that suits your stay.`}
            />
            <div className={`grid gap-8 ${roomTypes.length > 1 ? 'md:grid-cols-2' : 'max-w-xl mx-auto'}`}>
              {roomTypes.map((rt, i) => {
                const img = gallery[i]?.src || images[i]?.src || images[0]?.src;
                const expanded = openRoom === rt.type;
                const Icon = rt.type === 'AC' ? Snowflake : Fan;
                return (
                  <article key={rt.type} className={`reveal reveal-delay-${i + 1} group rounded-3xl overflow-hidden bg-cream border border-cream-100 shadow-sm hover:shadow-2xl transition-shadow duration-500`}>
                    <Photo src={img} alt={`${rt.type} room`} className="h-64">
                      <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-night/80 backdrop-blur px-3 py-1.5 text-xs font-semibold text-white">
                        <Icon className="w-3.5 h-3.5 text-gold-300" /> {rt.type}
                      </span>
                    </Photo>
                    <div className="p-6 sm:p-7">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display text-2xl text-ink">{rt.type} Room</h3>
                          <p className="mt-1 text-sm text-ink-soft flex items-center gap-3">
                            {rt.maxGuests && <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" /> Up to {rt.maxGuests} guests</span>}
                            {rt.rooms > 0 && <span className="inline-flex items-center gap-1"><BedDouble className="w-4 h-4" /> {rt.rooms} rooms</span>}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] uppercase tracking-wider text-ink-soft">{rt.maxPrice > rt.startingPrice ? 'From' : 'Per night'}</p>
                          <p className="font-display text-3xl text-ink">{formatINR(rt.startingPrice)}</p>
                          {rt.maxPrice > rt.startingPrice && <p className="text-xs text-ink-soft">up to {formatINR(rt.maxPrice)}</p>}
                        </div>
                      </div>
                      {rt.amenities?.length > 0 && (
                        <ul className="mt-5 flex flex-wrap gap-2">
                          {(expanded ? rt.amenities : rt.amenities.slice(0, 5)).map((a) => (
                            <li key={a} className="rounded-full bg-white border border-cream-100 px-3 py-1 text-xs font-medium text-ink-soft">{a}</li>
                          ))}
                          {!expanded && rt.amenities.length > 5 && (
                            <li className="rounded-full px-3 py-1 text-xs text-ink-soft">+{rt.amenities.length - 5} more</li>
                          )}
                        </ul>
                      )}
                      {expanded && (
                        <div className="mt-5 rounded-2xl bg-white border border-cream-100 p-4 text-sm text-ink-soft space-y-1.5">
                          <p>Price per night: <span className="font-semibold text-ink">{formatINR(rt.startingPrice)}{rt.maxPrice > rt.startingPrice ? ` – ${formatINR(rt.maxPrice)}` : ''}</span> (depends on the room)</p>
                          {hotel.checkInTime && <p>Check-in from <span className="font-semibold text-ink">{formatClock(hotel.checkInTime)}</span>, check-out by <span className="font-semibold text-ink">{formatClock(hotel.checkOutTime)}</span></p>}
                          <p>{online ? 'The exact price is shown before you confirm your booking.' : 'Final price is confirmed on WhatsApp.'}</p>
                        </div>
                      )}
                      <div className="mt-6 flex flex-wrap gap-3">
                        <button type="button" onClick={() => book({ roomType: rt.type })} className="btn-gold flex-1 sm:flex-none">
                          <CalendarDays className="w-4 h-4" /> Book Now
                        </button>
                        <button type="button" onClick={() => setOpenRoom(expanded ? null : rt.type)} className="btn-outline-ink flex-1 sm:flex-none" aria-expanded={expanded}>
                          {expanded ? 'Hide details' : 'View Details'} <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ Amenities */}
      {amenities.length > 0 && (
        <section id="amenities" className="site-section py-20 sm:py-28 bg-night text-white relative overflow-hidden">
          <GoldBubbles variant="dark" soft className="absolute inset-0 w-full h-full" />
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
            <SectionHeading light eyebrow="Amenities" title="Everything for a comfortable stay" intro="Facilities available in our rooms." />
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {amenities.map((a, i) => (
                <li
                  key={a.name}
                  className={`reveal reveal-delay-${(i % 3) + 1} rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:bg-white/[0.08] hover:border-gold/40 transition-colors`}
                >
                  <span className="w-11 h-11 rounded-xl bg-gold/15 text-gold-300 flex items-center justify-center">
                    <a.icon className="w-5 h-5" />
                  </span>
                  <p className="mt-4 font-semibold">{a.name}</p>
                  {a.text && <p className="mt-1 text-sm text-white/65">{a.text}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ Gallery */}
      {gallery.length > 0 && (
        <section id="gallery" className="site-section py-20 sm:py-28 relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
            <SectionHeading eyebrow="Gallery" title="A look inside" intro="Tap a photo to view it full screen." />
            <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[160px] sm:auto-rows-[200px] gap-3 sm:gap-4">
              {gallery.map((img, i) => (
                <button
                  key={img.src}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className={`reveal group relative rounded-2xl overflow-hidden bg-night-800 ${i % 5 === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
                  aria-label={img.caption || `Open photo ${i + 1}`}
                >
                  <img src={img.src} alt={img.caption || ''} loading="lazy" className="img-zoom absolute inset-0 w-full h-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-night/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                    <span className="text-sm text-white text-left">{img.caption}</span>
                    <ZoomIn className="w-5 h-5 text-white flex-shrink-0" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ Location */}
      {(mapSrc || address) && (
        <section id="location" className="site-section py-20 sm:py-28 bg-white relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
            <SectionHeading eyebrow="Location" title="How to find us" />
            <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-stretch">
              {mapSrc && (
                <div className="reveal rounded-3xl overflow-hidden border border-cream-100 shadow-sm min-h-[320px] lg:min-h-[420px] bg-cream">
                  <iframe
                    title={`Map of ${hotel.name}`}
                    src={mapSrc}
                    className="w-full h-full min-h-[320px] lg:min-h-[420px] border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              )}
              <div className={`reveal reveal-delay-1 rounded-3xl bg-night text-white p-7 flex flex-col ${mapSrc ? '' : 'lg:col-span-2 max-w-xl'}`}>
                <h3 className="font-display text-2xl">{hotel.name}</h3>
                {address && (
                  <p className="mt-4 flex items-start gap-3 text-white/85">
                    <MapPin className="w-5 h-5 text-gold-300 mt-0.5 flex-shrink-0" /> {address}
                  </p>
                )}
                {hotel.phone && (
                  <a href={telLink(hotel.phone)} className="mt-3 flex items-center gap-3 text-white/85 hover:text-gold-300">
                    <Phone className="w-5 h-5 text-gold-300" /> {hotel.phone}
                  </a>
                )}
                {hotel.checkInTime && (
                  <p className="mt-3 flex items-center gap-3 text-white/85">
                    <Clock className="w-5 h-5 text-gold-300" /> Check-in {formatClock(hotel.checkInTime)} · Check-out {formatClock(hotel.checkOutTime)}
                  </p>
                )}
                <div className="mt-auto pt-8 flex flex-wrap gap-3">
                  <a href={directionsUrl(hotel)} target="_blank" rel="noopener noreferrer" className="btn-gold">
                    <Navigation className="w-4 h-4" /> Get Directions
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ Contact */}
      <section id="contact" className="site-section py-20 sm:py-28 bg-cream-100 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-12">
          <div>
            <SectionHeading align="left" eyebrow="Contact us" title="Plan your stay" intro="Send your dates and we'll reply on WhatsApp with availability and the price." />
            <ul className="reveal space-y-4 -mt-4">
              {hotel.phone && (
                <li>
                  <a href={telLink(hotel.phone)} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="w-11 h-11 rounded-xl bg-night text-gold-300 flex items-center justify-center"><Phone className="w-5 h-5" /></span>
                    <span><span className="block text-[11px] uppercase tracking-wider text-ink-soft">Call</span><span className="font-semibold text-ink">{hotel.phone}</span></span>
                  </a>
                </li>
              )}
              {hotel.whatsappNumber && (
                <li>
                  <a href={waLink(hotel.whatsappNumber)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="w-11 h-11 rounded-xl bg-night text-gold-300 flex items-center justify-center"><MessageCircle className="w-5 h-5" /></span>
                    <span><span className="block text-[11px] uppercase tracking-wider text-ink-soft">WhatsApp</span><span className="font-semibold text-ink">{hotel.whatsappNumber}</span></span>
                  </a>
                </li>
              )}
              {hotel.email && (
                <li>
                  <a href={`mailto:${hotel.email}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="w-11 h-11 rounded-xl bg-night text-gold-300 flex items-center justify-center"><Mail className="w-5 h-5" /></span>
                    <span className="min-w-0"><span className="block text-[11px] uppercase tracking-wider text-ink-soft">Email</span><span className="font-semibold text-ink break-all">{hotel.email}</span></span>
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
                  <span className="w-11 h-11 rounded-xl bg-night text-gold-300 flex items-center justify-center flex-shrink-0"><MapPin className="w-5 h-5" /></span>
                  <span><span className="block text-[11px] uppercase tracking-wider text-ink-soft">Address</span><span className="font-semibold text-ink">{address}</span></span>
                </li>
              )}
            </ul>
          </div>
          <div className="reveal reveal-delay-1 rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-cream-100">
            <h3 className="font-display text-2xl text-ink mb-6">Send an enquiry</h3>
            <EnquiryForm hotels={hotels} />
          </div>
        </div>
      </section>

      <Footer brand={hotel.name} tagline={tagline} links={links} hotel={hotel} />
      <BackToTop />

      {/* Mobile: always-visible booking bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-night/95 backdrop-blur border-t border-white/10 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {lowest != null && <p className="text-xs text-white/70">Rooms from</p>}
          <p className="text-white font-semibold truncate">{lowest != null ? `${formatINR(lowest)} / night` : hotel.name}</p>
        </div>
        <button type="button" onClick={() => book()} className="btn-gold !py-2.5">
          <CalendarDays className="w-4 h-4" /> Book Now
        </button>
      </div>
      <div className="sm:hidden h-16" />

      <EnquiryDialog open={enquiry.open} onClose={closeEnquiry} hotels={hotels} prefill={enquiry.prefill} />
      {lightbox != null && (
        <Lightbox
          images={gallery.map((g) => g.src)}
          captions={gallery.map((g) => g.caption)}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
