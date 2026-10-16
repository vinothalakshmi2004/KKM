import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LogOut, ChevronLeft, ChevronRight, X, Menu, Sun, Moon, ChevronDown, Building2,
} from 'lucide-react';
import { orderedNavItems } from './navItems';
import { useAuth } from '../context/AuthContext';
import { useHotel } from '../context/HotelContext';
import { useTheme } from '../context/ThemeContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getHotels, getOnlineUnseenCount, listOf, dataOf } from '../api/services';
import { useSocket } from '../hooks/useSocket';
import { disconnectSocket } from '../utils/socket';
import toast from 'react-hot-toast';
import BrandLogo from '../components/BrandLogo';

// Sidebar pages + the admin's saved order / hidden pages (Settings → Sidebar)

function NavItem({ to, label, icon: Icon, end, collapsed, onClick, badge = 0 }) {
  const count = badge > 99 ? '99+' : badge;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        isActive ? `sidebar-link-active ${collapsed ? 'justify-center' : ''}` : `sidebar-link-inactive ${collapsed ? 'justify-center' : ''}`
      }
    >
      <span className="relative flex-shrink-0">
        <Icon className="w-5 h-5" />
        {collapsed && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 rounded-full bg-red-700 text-white text-[10px] font-bold leading-4 text-center">{count}</span>
        )}
      </span>
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {!collapsed && badge > 0 && (
        <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-700 text-white text-[11px] font-bold leading-5 text-center" aria-label={`${badge} new`}>
          {count}
        </span>
      )}
    </NavLink>
  );
}

export default function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = useAuth();
  const { selectedHotelId, selectHotel, clearHotel, hotels, setHotels } = useHotel();
  const queryClient = useQueryClient();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const { data: hotelsData, isSuccess: hotelsLoaded } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => getHotels().then(listOf),
  });

  useEffect(() => {
    if (!hotelsLoaded) return;
    const list = hotelsData || [];
    setHotels(list);
    // First run: nothing to manage yet
    if (list.length === 0) {
      navigate('/admin/onboarding', { replace: true });
      return;
    }
    // No selection yet, or the saved hotel was deleted
    if (!list.some((h) => (h._id || h.id) === selectedHotelId)) {
      selectHotel(list[0]._id || list[0].id);
    }
  }, [hotelsLoaded, hotelsData, selectedHotelId, selectHotel, setHotels, navigate]);

  useSocket(selectedHotelId);

  // The admin shell is a fixed frame: only <main> scrolls, the window never moves or bounces
  useEffect(() => {
    document.documentElement.classList.add('admin-shell');
    return () => document.documentElement.classList.remove('admin-shell');
  }, []);

  // Unseen online bookings for the selected hotel (kept live by socket events)
  const { data: unseenOnline = 0 } = useQuery({
    queryKey: ['online-unseen', selectedHotelId],
    queryFn: () => getOnlineUnseenCount(selectedHotelId).then((r) => dataOf(r)?.unseen || 0),
    enabled: !!selectedHotelId,
    refetchInterval: 60_000,
  });
  const badges = { online: unseenOnline };

  const handleLogout = () => {
    disconnectSocket();
    clearHotel();
    queryClient.clear();
    logout();
    navigate('/login');
  };

  // Plain render function, not a component defined here: a nested component would be a new type on
  // every render, remounting the sidebar and resetting its scroll position on each page change
  const renderSidebar = (onNav) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-ink-200 dark:border-ink-700 ${collapsed ? 'justify-center' : ''}`}>
        <BrandLogo className="w-9 h-9 rounded-lg" />
        {!collapsed && (
          <div>
            <p className="font-bold text-ink-900 dark:text-white text-sm leading-tight">KKM Hotels</p>
            <p className="text-xs text-ink-500 dark:text-ink-400">Management</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {orderedNavItems(user?.preferences?.sidebar).filter((item) => !item.hidden).map((item) => (
          <NavItem key={item.to} {...item} badge={badges[item.badgeKey] || 0} collapsed={collapsed} onClick={onNav} />
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-ink-200 dark:border-ink-700 space-y-2">
        {!collapsed && (
          <div className="px-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-700/50">
            <p className="text-xs font-medium text-ink-700 dark:text-ink-200 truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-ink-400 truncate">{user?.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`sidebar-link-inactive w-full ${collapsed ? 'justify-center' : ''} text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen h-[100dvh] bg-[rgb(var(--color-bg))] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`no-print hidden lg:flex flex-col bg-white dark:bg-ink-800 border-r border-ink-200 dark:border-ink-700 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        {renderSidebar()}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-full ml-px z-10 w-5 h-10 bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-r-md flex items-center justify-center text-ink-400 hover:text-brand-600 transition-colors"
          style={{ left: collapsed ? '64px' : '240px' }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-ink-800 shadow-xl animate-slide-in">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-ink-400 hover:text-ink-600">
              <X className="w-5 h-5" />
            </button>
            {renderSidebar(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Bar */}
        <header className="no-print h-14 flex items-center gap-3 px-4 bg-white dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700 flex-shrink-0">
          <button className="lg:hidden text-ink-500 hover:text-ink-900 dark:hover:text-white" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          {/* Hotel Switcher: every admin page shows data for this hotel only */}
          <div className="flex items-center gap-2 flex-1 max-w-sm min-w-0">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-ink-500 dark:text-ink-400 flex-shrink-0">
              <Building2 className="w-4 h-4 text-brand-600" /> Hotel
            </span>
            <div className="relative flex-1 min-w-0">
            <select
              value={selectedHotelId || ''}
              onChange={(e) => {
                selectHotel(e.target.value);
                const h = hotels.find((x) => (x._id || x.id) === e.target.value);
                if (h) toast.success(`Now managing ${h.name}`, { id: 'hotel-switch' });
              }}
              title="All pages show data for the selected hotel"
              className="input text-sm py-1.5 pr-8 appearance-none cursor-pointer font-semibold border-brand-400 dark:border-brand-600 bg-brand-50 dark:bg-brand-900/20 text-brand-800 dark:text-brand-200"
            >
              {!selectedHotelId && <option value="" className="bg-white dark:bg-ink-800 text-ink-900 dark:text-white">Select hotel…</option>}
              {hotels.map((h) => (
                <option key={h._id || h.id} value={h._id || h.id} className="bg-white dark:bg-ink-800 text-ink-900 dark:text-white" style={{ backgroundColor: 'var(--option-bg, #fff)', color: 'var(--option-text, #111)' }}>
                  {h.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600 pointer-events-none" />
            </div>
          </div>

          <div className="flex-1" />

          {/* Theme Toggle */}
          <button onClick={toggle} className="btn-ghost p-2" aria-label="Toggle theme">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overscroll-contain p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
