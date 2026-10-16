import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  MapPin, Phone, Mail, MessageCircle, Navigation, ArrowRight, CalendarDays, BedDouble, Snowflake, Fan, Building2, LogIn,
} from 'lucide-react';
import { getPublicHotels, getPublicHotel, getHotelCoverUrl, listOf, dataOf } from '../../api/services';
import { formatINR } from '../../utils/currency';
import HotelExperience from '../../components/landing/HotelExperience';
import Navbar from '../../components/landing/Navbar';
import HeroSearch from '../../components/landing/HeroSearch';
import SectionHeading from '../../components/landing/SectionHeading';
import EnquiryDialog from '../../components/landing/EnquiryDialog';
import EnquiryForm from '../../components/landing/EnquiryForm';
import Footer from '../../components/landing/Footer';
import BackToTop from '../../components/landing/BackToTop';
import { amenityInfo } from '../../components/landing/amenities';
import { useReveal } from '../../components/landing/useReveal';
import { bookingHref, directionsUrl, fullAddress, hotelImages, scrollToSection, telLink, waLink } from '../../components/landing/siteUtils';
import BrandLogo from '../../components/BrandLogo';
import GoldBubbles from '../../components/GoldBubbles';

const BRAND = 'KKM Hotels';

function FullPageLoader() {
  return (
    <div className="site min-h-screen flex flex-col items-center justify-center gap-4 bg-night">
      <BrandLogo full className="w-24 h-24 rounded-2xl" />
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** One active hotel: its full page directly on the landing page. */
function SingleHotel({ slug }) {
  const { data: hotel, isLoading } = useQuery({
    queryKey: ['public-hotel', slug],
    queryFn: () => getPublicHotel(slug).then(dataOf),
  });
  if (isLoading || !hotel) return <FullPageLoader />;
  return <HotelExperience hotel={hotel} />;
}

/** Several active hotels: hero + search, hotel cards, amenities, contact per hotel. */
function MultiHotel({ hotels }) {
  // Details (address, phone, prices per AC/Non-AC, amenities) for each hotel
  const detailQueries = useQueries({
    queries: hotels.map((h) => ({
      queryKey: ['public-hotel', h.slug],
      queryFn: () => getPublicHotel(h.slug).then(dataOf),
    })),
  });
  const details = Object.fromEntries(detailQueries.filter((q) => q.data).map((q) => [q.data.slug, q.data]));
  const detailsReady = detailQueries.every((q) => !q.isLoading);

  const [enquiry, setEnquiry] = useState({ open: false, prefill: {} });
  const navigate = useNavigate();
  // Book Now: the online booking page (hotel picker when no hotel is chosen yet).
  // A hotel with online booking switched off gets the WhatsApp enquiry form instead.
  const book = useCallback(
    (prefill = {}) => {
      const target = prefill.hotelSlug && hotels.find((h) => h.slug === prefill.hotelSlug);
      if (target && target.onlineBookingEnabled === false) return setEnquiry({ open: true, prefill });
      if (!target && !hotels.some((h) => h.onlineBookingEnabled !== false)) return setEnquiry({ open: true, prefill });
      navigate(bookingHref(target?.slug, prefill));
    },
    [hotels, navigate]
  );
  const closeEnquiry = useCallback(() => setEnquiry((e) => ({ ...e, open: false })), []);

  const enquiryHotels = useMemo(() => hotels.map((h) => ({ slug: h.slug, name: h.name, whatsappNumber: h.whatsappNumber })), [hotels]);

  const amenities = useMemo(() => {
    const seen = new Map();
    Object.values(details).forEach((d) =>
      (d.roomTypes || []).forEach((rt) => (rt.amenities || []).forEach((a) => {
        const key = a.trim().toLowerCase();
        if (key && !seen.has(key)) seen.set(key, a.trim());
      }))
    );
    return [...seen.values()].map(amenityInfo);
  }, [details]);

  const links = useMemo(
    () =>
      [
        { id: 'top', label: 'Home' },
        { id: 'hotels', label: 'Our Hotels' },
        amenities.length && { id: 'amenities', label: 'Amenities' },
        { id: 'contact', label: 'Contact Us' },
      ].filter(Boolean),
    [amenities.length]
  );

  useReveal([hotels.length, detailsReady, links.length]);

  const heroImage =
    hotels.map((h) => getHotelCoverUrl(h)).find(Boolean) ||
    Object.values(details).map((d) => hotelImages(d)[0]?.src).find(Boolean);
  const lowest = Math.min(...hotels.map((h) => h.startingPrice).filter((p) => p != null));

  return (
    <div className="site min-h-screen">
      <Navbar brand={BRAND} subtitle={`${hotels.length} hotels`} links={links} onBook={() => book()} />

      {/* ------------------------------------------------------------------ Hero */}
      <section id="top" className="site-section relative min-h-[100svh] flex items-end overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-night-700 via-night-800 to-night">
          {heroImage && <img src={heroImage} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/45 to-night/90" />
        <div className="absolute -bottom-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-gold/10 blur-3xl" />
        {/* Rising golden bubbles behind the hero text */}
        <GoldBubbles className="absolute inset-0 w-full h-full" />
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-12 sm:pb-16">
          <h1 className="reveal reveal-delay-1 font-display text-4xl sm:text-6xl lg:text-7xl text-white max-w-4xl leading-[1.05]">
            Your Perfect Stay <span className="italic text-gold-300">Awaits You</span>
          </h1>
          <p className="reveal reveal-delay-2 mt-5 text-base sm:text-xl text-white/85 max-w-2xl leading-relaxed">
            Comfortable rooms, warm hospitality, and an unforgettable experience, all at great value.
          </p>
          <div className="reveal reveal-delay-2 mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => book()} className="btn-gold">
              <CalendarDays className="w-4 h-4" /> Book Now
            </button>
            <button type="button" onClick={() => scrollToSection('hotels')} className="btn-ghost-light">
              View Hotels <ArrowRight className="w-4 h-4" />
            </button>
            {Number.isFinite(lowest) && (
              <span className="text-sm text-white/80 ml-1">
                Rooms from <span className="text-gold-300 font-semibold">{formatINR(lowest)}</span> / night
              </span>
            )}
          </div>
          <div className="reveal reveal-delay-3 mt-10">
            <HeroSearch hotels={enquiryHotels} onSearch={(values) => book(values)} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ Hotels */}
      <section id="hotels" className="site-section py-20 sm:py-28 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading eyebrow="Our hotels" title="Pick your place to stay" intro="Every room can be booked as AC or Non-AC. Tap a hotel to see rooms, photos and location." />
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {hotels.map((h, i) => {
              const d = details[h.slug];
              const img = getHotelCoverUrl(h) || (d && hotelImages(d)[0]?.src);
              return (
                <article key={h.slug} className={`reveal reveal-delay-${(i % 3) + 1} group rounded-3xl overflow-hidden bg-white border border-cream-100 shadow-sm hover:shadow-2xl transition-shadow duration-500 flex flex-col`}>
                  <Link to={`/hotel/${h.slug}`} className="relative h-60 overflow-hidden bg-gradient-to-br from-night-700 to-night block">
                    {img ? (
                      <img src={img} alt={h.name} loading="lazy" className="img-zoom absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex flex-col items-center justify-center text-gold-300/70">
                        <Building2 className="w-10 h-10" />
                        <span className="mt-2 text-[11px] tracking-[0.2em] uppercase">Photo coming soon</span>
                      </span>
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-night/80 via-transparent to-transparent" />
                    <span className="absolute bottom-4 left-5 right-5">
                      <span className="font-display text-2xl text-white block leading-tight">{h.name}</span>
                      {(h.area || h.city) && (
                        <span className="mt-1 text-sm text-white/85 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{[h.area, h.city].filter(Boolean).join(', ')}</span>
                      )}
                    </span>
                  </Link>
                  <div className="p-6 flex-1 flex flex-col">
                    {d?.roomTypes?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {d.roomTypes.map((rt) => (
                          <div key={rt.type} className="rounded-2xl bg-cream p-3">
                            <p className="text-[11px] uppercase tracking-wider text-ink-soft flex items-center gap-1">
                              {rt.type === 'AC' ? <Snowflake className="w-3.5 h-3.5" /> : <Fan className="w-3.5 h-3.5" />} {rt.type}
                            </p>
                            <p className="font-display text-xl text-ink mt-0.5">{formatINR(rt.startingPrice)}<span className="text-xs font-sans text-ink-soft"> /night</span></p>
                          </div>
                        ))}
                      </div>
                    ) : h.startingPrice != null ? (
                      <p className="text-ink-soft">Rooms from <span className="font-display text-2xl text-ink">{formatINR(h.startingPrice)}</span> / night</p>
                    ) : (
                      <p className="text-ink-soft">Contact us for rates</p>
                    )}
                    {h.roomCount > 0 && (
                      <p className="mt-3 text-sm text-ink-soft flex items-center gap-1.5"><BedDouble className="w-4 h-4" /> {h.roomCount} rooms</p>
                    )}
                    {d?.roomTypes?.[0]?.amenities?.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {[...new Set(d.roomTypes.flatMap((rt) => rt.amenities))].slice(0, 4).map((a) => (
                          <li key={a} className="rounded-full border border-cream-100 bg-cream px-3 py-1 text-xs text-ink-soft">{a}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto pt-6 flex gap-3">
                      <button type="button" onClick={() => book({ hotelSlug: h.slug })} className="btn-gold flex-1 !px-4">
                        <CalendarDays className="w-4 h-4" /> Book Now
                      </button>
                      <Link to={`/hotel/${h.slug}`} className="btn-outline-ink flex-1">
                        View Hotel <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ Amenities */}
      {amenities.length > 0 && (
        <section id="amenities" className="site-section py-20 sm:py-28 bg-night text-white relative overflow-hidden">
          <GoldBubbles variant="dark" soft className="absolute inset-0 w-full h-full" />
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
            <SectionHeading light eyebrow="Amenities" title="Everything for a comfortable stay" intro="Facilities available in the rooms of our hotels." />
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {amenities.map((a, i) => (
                <li key={a.name} className={`reveal reveal-delay-${(i % 3) + 1} rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:bg-white/[0.08] hover:border-gold/40 transition-colors`}>
                  <span className="w-11 h-11 rounded-xl bg-gold/15 text-gold-300 flex items-center justify-center"><a.icon className="w-5 h-5" /></span>
                  <p className="mt-4 font-semibold">{a.name}</p>
                  {a.text && <p className="mt-1 text-sm text-white/65">{a.text}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ Contact */}
      <section id="contact" className="site-section py-20 sm:py-28 bg-cream-100 relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading eyebrow="Contact us" title="Plan your stay" intro="Send your dates and we'll reply on WhatsApp with availability and the price." />
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10">
            <ul className="space-y-5">
              {hotels.map((h, i) => {
                const d = details[h.slug] || h;
                const address = fullAddress(d);
                return (
                  <li key={h.slug} className={`reveal reveal-delay-${(i % 3) + 1} rounded-3xl bg-white p-6 shadow-sm border border-cream-100`}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-xl text-ink">{h.name}</h3>
                      <Link to={`/hotel/${h.slug}`} className="text-sm text-gold-600 hover:underline flex-shrink-0">View hotel</Link>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-ink-soft">
                      {address && <p className="flex items-start gap-2.5"><MapPin className="w-4 h-4 mt-0.5 text-gold-600 flex-shrink-0" />{address}</p>}
                      {d.phone && <a href={telLink(d.phone)} className="flex items-center gap-2.5 hover:text-ink"><Phone className="w-4 h-4 text-gold-600" />{d.phone}</a>}
                      {d.email && <a href={`mailto:${d.email}`} className="flex items-center gap-2.5 hover:text-ink break-all"><Mail className="w-4 h-4 text-gold-600 flex-shrink-0" />{d.email}</a>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {h.whatsappNumber && (
                        <a href={waLink(h.whatsappNumber)} target="_blank" rel="noopener noreferrer" className="btn-outline-ink !py-2 text-sm">
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>
                      )}
                      {address && (
                        <a href={directionsUrl(d)} target="_blank" rel="noopener noreferrer" className="btn-outline-ink !py-2 text-sm">
                          <Navigation className="w-4 h-4" /> Get Directions
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="reveal reveal-delay-1 rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-cream-100 self-start">
              <h3 className="font-display text-2xl text-ink mb-6">Send an enquiry</h3>
              <EnquiryForm hotels={enquiryHotels} />
            </div>
          </div>
        </div>
      </section>

      <Footer
        brand={BRAND}
        tagline="Comfortable rooms, warm hospitality, and an unforgettable experience, all at great value."
        links={links}
        hotels={hotels}
      />
      <BackToTop />

      {/* Mobile: always-visible booking bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-night/95 backdrop-blur border-t border-white/10 px-4 py-3 flex items-center gap-3">
        <p className="flex-1 min-w-0 text-white font-semibold truncate">
          {Number.isFinite(lowest) ? `From ${formatINR(lowest)} / night` : BRAND}
        </p>
        <button type="button" onClick={() => book()} className="btn-gold !py-2.5">
          <CalendarDays className="w-4 h-4" /> Book Now
        </button>
      </div>
      <div className="sm:hidden h-16" />

      <EnquiryDialog open={enquiry.open} onClose={closeEnquiry} hotels={enquiryHotels} prefill={enquiry.prefill} />
    </div>
  );
}

export default function LandingPage() {
  const { data: hotels = [], isLoading, isError } = useQuery({
    queryKey: ['public-hotels'],
    queryFn: () => getPublicHotels().then(listOf),
  });

  if (isLoading) return <FullPageLoader />;

  if (hotels.length === 1) return <SingleHotel slug={hotels[0].slug} />;

  if (hotels.length === 0) {
    return (
      <div className="site min-h-screen bg-night flex flex-col items-center justify-center text-center px-6">
        <BrandLogo full className="w-28 h-28 rounded-2xl" />
        <h1 className="font-display text-4xl text-white mt-6">{BRAND}</h1>
        <p className="text-white/75 mt-3 max-w-md">
          {isError ? 'We could not load our hotels right now. Please try again in a moment.' : 'Our hotels will be listed here soon.'}
        </p>
        <Link to="/login" className="mt-8 inline-flex items-center gap-2 text-sm text-gold-300 hover:text-gold">
          <LogIn className="w-4 h-4" /> Admin Login
        </Link>
      </div>
    );
  }

  return <MultiHotel hotels={hotels} />;
}
