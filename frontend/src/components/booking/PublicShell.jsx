import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft } from 'lucide-react';
import BrandLogo from '../BrandLogo';

/**
 * Frame for the guest booking pages: navy header like the website navbar, cream page.
 * Uses the website colours only (text-ink / bg-cream / btn-gold), which look the same in
 * light and dark mode, exactly like the landing page.
 */
export default function PublicShell({ title, backTo = '/', backLabel = 'Home', children, wide = false }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="site min-h-screen flex flex-col">
      <header className="bg-night text-white sticky top-0 z-30 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
        <div className={`${wide ? 'max-w-6xl' : 'max-w-4xl'} mx-auto px-4 sm:px-6 h-16 flex items-center gap-3`}>
          <Link to={backTo} className="flex items-center gap-3 min-w-0 group" aria-label={backLabel}>
            <BrandLogo className="w-9 h-9 rounded-xl" />
            <span className="min-w-0">
              <span className="block font-display text-base sm:text-lg leading-tight truncate">{title}</span>
              <span className="flex items-center gap-1 text-[11px] tracking-[0.15em] uppercase text-gold-300">
                <ChevronLeft className="w-3 h-3" /> {backLabel}
              </span>
            </span>
          </Link>
          <Link to="/booking-status" className="ml-auto inline-flex items-center gap-1.5 text-sm text-white/85 hover:text-white flex-shrink-0">
            <Search className="w-4 h-4" /> <span className="hidden sm:inline">Check booking</span><span className="sm:hidden">Status</span>
          </Link>
        </div>
      </header>
      <main className={`flex-1 w-full ${wide ? 'max-w-6xl' : 'max-w-4xl'} mx-auto px-4 sm:px-6 py-6 sm:py-10`}>{children}</main>
      <footer className="text-center text-xs text-ink-soft py-6">
        Instant confirmation · Pay at the hotel
      </footer>
    </div>
  );
}

export function PublicCard({ className = '', children }) {
  return <div className={`rounded-3xl bg-white border border-cream-100 shadow-sm p-5 sm:p-7 ${className}`}>{children}</div>;
}

export function FullPageSpinner() {
  return (
    <div className="site min-h-screen flex items-center justify-center bg-night">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
