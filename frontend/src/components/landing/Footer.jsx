import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, MessageCircle, Clock, LogIn } from 'lucide-react';
import { formatINR } from '../../utils/currency';
import { formatClock } from '../../utils/date';
import { scrollToSection, fullAddress, telLink, waLink } from './siteUtils';
import BrandLogo from '../BrandLogo';
import GoldBubbles from '../GoldBubbles';

const Heading = ({ children }) => (
  <h3 className="text-xs font-semibold tracking-[0.25em] uppercase text-gold-300 mb-4">{children}</h3>
);

/**
 * Site footer. Single hotel: its links, room types, contact and house timings.
 * Several hotels: a column of hotel links instead of room types.
 */
export default function Footer({ brand, tagline, links, hotel, hotels = [] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-night text-white relative overflow-hidden">
      <GoldBubbles variant="dark" soft className="absolute inset-0 w-full h-full" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <BrandLogo className="w-11 h-11 rounded-xl" />
            <span className="font-display text-xl">{brand}</span>
          </div>
          {tagline && <p className="mt-4 text-sm text-white/70 leading-relaxed">{tagline}</p>}
          {hotel?.whatsappNumber && (
            <a
              href={waLink(hotel.whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm hover:border-gold hover:text-gold-300 transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
            </a>
          )}
        </div>

        <div>
          <Heading>Quick links</Heading>
          <ul className="space-y-2.5 text-sm text-white/80">
            {links.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => scrollToSection(l.id)} className="hover:text-gold-300 transition-colors">
                  {l.label}
                </button>
              </li>
            ))}
            <li>
              <Link to="/login" className="inline-flex items-center gap-1.5 hover:text-gold-300 transition-colors">
                <LogIn className="w-3.5 h-3.5" /> Admin Login
              </Link>
            </li>
          </ul>
        </div>

        <div>
          {hotel ? (
            <>
              <Heading>Rooms</Heading>
              <ul className="space-y-2.5 text-sm text-white/80">
                {(hotel.roomTypes || []).map((rt) => (
                  <li key={rt.type}>
                    <button type="button" onClick={() => scrollToSection('rooms')} className="hover:text-gold-300 transition-colors">
                      {rt.type} Room · from {formatINR(rt.startingPrice)}
                    </button>
                  </li>
                ))}
              </ul>
              {(hotel.checkInTime || hotel.checkOutTime) && (
                <div className="mt-8">
                  <Heading>House timings</Heading>
                  <p className="text-sm text-white/80 flex items-start gap-2 -mt-1">
                    <Clock className="w-4 h-4 mt-0.5 text-gold-300 flex-shrink-0" />
                    Check-in {formatClock(hotel.checkInTime)} · Check-out {formatClock(hotel.checkOutTime)}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <Heading>Our hotels</Heading>
              <ul className="space-y-2.5 text-sm text-white/80">
                {hotels.map((h) => (
                  <li key={h.slug}>
                    <Link to={`/hotel/${h.slug}`} className="hover:text-gold-300 transition-colors">
                      {h.name}{h.area || h.city ? <span className="text-white/50"> · {h.area || h.city}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <Heading>Contact</Heading>
          {hotel ? (
            <ul className="space-y-3 text-sm text-white/80">
              {fullAddress(hotel) && (
                <li className="flex items-start gap-2.5"><MapPin className="w-4 h-4 mt-0.5 text-gold-300 flex-shrink-0" />{fullAddress(hotel)}</li>
              )}
              {hotel.phone && (
                <li><a href={telLink(hotel.phone)} className="flex items-center gap-2.5 hover:text-gold-300"><Phone className="w-4 h-4 text-gold-300" />{hotel.phone}</a></li>
              )}
              {hotel.email && (
                <li><a href={`mailto:${hotel.email}`} className="flex items-center gap-2.5 hover:text-gold-300 break-all"><Mail className="w-4 h-4 text-gold-300 flex-shrink-0" />{hotel.email}</a></li>
              )}
            </ul>
          ) : (
            <ul className="space-y-3 text-sm text-white/80">
              {hotels.filter((h) => h.whatsappNumber).map((h) => (
                <li key={h.slug}>
                  <a href={waLink(h.whatsappNumber)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:text-gold-300">
                    <MessageCircle className="w-4 h-4 text-gold-300" /> {h.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/55">
          <p>© {year} {brand}. All rights reserved.</p>
          <p>Bookings are confirmed by the hotel over WhatsApp.</p>
        </div>
      </div>
    </footer>
  );
}
