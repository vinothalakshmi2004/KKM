import {
  LayoutDashboard, Hotel, BedDouble, CalendarCheck, Users,
  TrendingUp, Receipt, BarChart2, Image, MessageSquare, Settings, UserCheck, FileText, Globe, UserCog,
} from 'lucide-react';

/** Every admin sidebar page, in the default order. `to` doubles as the page's key. */
export const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, locked: true },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/admin/online-bookings', label: 'Online Bookings', icon: Globe, badgeKey: 'online' },
  { to: '/admin/inhouse', label: 'In-House', icon: UserCheck },
  { to: '/admin/invoices', label: 'Invoices', icon: FileText },
  { to: '/admin/guests', label: 'Guests', icon: Users },
  { to: '/admin/income', label: 'Income', icon: TrendingUp },
  { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
  { to: '/admin/reports', label: 'Reports', icon: BarChart2 },
  { to: '/admin/gallery', label: 'Gallery', icon: Image },
  { to: '/admin/enquiries', label: 'Enquiries', icon: MessageSquare },
  { to: '/admin/hotels', label: 'Hotels', icon: Hotel },
  { to: '/admin/rooms', label: 'Rooms', icon: BedDouble },
  { to: '/admin/employees', label: 'Employees', icon: UserCog },
  // Always shown, so the sidebar can always be changed back
  { to: '/admin/settings', label: 'Settings', icon: Settings, locked: true },
];

/**
 * Sidebar items in the admin's saved order. Pages added to the app later (not in the saved
 * order yet) appear right after the page they follow by default. `hidden` pages get
 * `hidden: true`; Dashboard and Settings can never be hidden.
 */
export function orderedNavItems(prefs = {}) {
  const byKey = new Map(NAV_ITEMS.map((i) => [i.to, i]));
  const saved = (prefs.order || []).filter((k) => byKey.has(k));
  const keys = [...saved];
  NAV_ITEMS.forEach((item, idx) => {
    if (keys.includes(item.to)) return;
    const prev = NAV_ITEMS.slice(0, idx).reverse().find((p) => keys.includes(p.to));
    keys.splice(prev ? keys.indexOf(prev.to) + 1 : 0, 0, item.to);
  });
  const hidden = new Set(prefs.hidden || []);
  return keys.map((k) => ({ ...byKey.get(k), hidden: !byKey.get(k).locked && hidden.has(k) }));
}
