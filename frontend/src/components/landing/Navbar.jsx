import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, LogIn, CalendarDays, Search } from 'lucide-react';
import { scrollToSection } from './siteUtils';
import BrandLogo from '../BrandLogo';

/**
 * Sticky site navbar. Transparent over the hero, solid once the page scrolls.
 * `links`: [{ id, label }] section ids on this page.
 */
export default function Navbar({ brand, subtitle, links, onBook, homeHref = '/' }) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    const onScroll = () => {
      setSolid(window.scrollY > 40);
      // Highlight the section currently under the navbar
      let current = '';
      for (const { id } of links) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [links]);

  // Close the mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => window.innerWidth >= 1024 && setOpen(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const go = (id) => {
    setOpen(false);
    scrollToSection(id);
  };

  const dark = solid || open;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
        dark ? 'bg-night/95 backdrop-blur-md shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]' : 'bg-gradient-to-b from-black/50 to-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-[72px] flex items-center gap-4">
        <Link to={homeHref} onClick={() => scrollToSection('top')} className="flex items-center gap-3 min-w-0 group">
          <BrandLogo className="w-10 h-10 rounded-xl shadow-lg" />
          <span className="min-w-0">
            <span className="block font-display text-lg text-white leading-tight truncate">{brand}</span>
            {subtitle && <span className="block text-[11px] tracking-[0.2em] uppercase text-gold-300 truncate">{subtitle}</span>}
          </span>
        </Link>

        <ul className="hidden lg:flex items-center gap-1 ml-auto">
          {links.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => go(l.id)}
                className={`px-3 py-2 text-sm rounded-full transition-colors ${
                  active === l.id ? 'text-gold-300' : 'text-white/85 hover:text-white'
                }`}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden lg:flex items-center gap-3 ml-4">
          <Link to="/booking-status" className="inline-flex items-center gap-1.5 text-sm text-white/85 hover:text-white">
            <Search className="w-4 h-4" /> My Booking
          </Link>
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-white/85 hover:text-white">
            <LogIn className="w-4 h-4" /> Admin Login
          </Link>
          <button type="button" onClick={onBook} className="btn-gold !py-2.5 !px-5 text-sm">
            <CalendarDays className="w-4 h-4" /> Book Now
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="lg:hidden ml-auto w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div className={`lg:hidden overflow-hidden transition-[max-height] duration-300 ${open ? 'max-h-[80vh]' : 'max-h-0'}`}>
        <div className="px-4 pb-6 pt-2 space-y-1 border-t border-white/10">
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => go(l.id)}
              className="block w-full text-left px-3 py-3 rounded-lg text-white/90 hover:bg-white/10"
            >
              {l.label}
            </button>
          ))}
          <Link to="/booking-status" className="flex items-center gap-2 px-3 py-3 rounded-lg text-white/90 hover:bg-white/10">
            <Search className="w-4 h-4" /> My Booking
          </Link>
          <Link to="/login" className="flex items-center gap-2 px-3 py-3 rounded-lg text-white/90 hover:bg-white/10">
            <LogIn className="w-4 h-4" /> Admin Login
          </Link>
          <button type="button" onClick={() => { setOpen(false); onBook(); }} className="btn-gold w-full mt-2">
            <CalendarDays className="w-4 h-4" /> Book Now
          </button>
        </div>
      </div>
    </header>
  );
}
