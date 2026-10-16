import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { useNavigate } from 'react-router-dom';
import {
  BedDouble, Users, TrendingUp, TrendingDown, LogIn, LogOut, CalendarCheck
} from 'lucide-react';
import { formatINR } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { SkeletonCard } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const ROOM_STATUS_COLORS = {
  Available: 'bg-emerald-700',
  Occupied: 'bg-rose-600',
  Reserved: 'bg-brand-600',
  Maintenance: 'bg-ink-500',
};

// Brand series: gold, steel blue, deep gold, light gold, slate blue, bronze, navy blue
const PIE_COLORS = ['#c9a45c', '#5b7bb2', '#8a6a2c', '#e3cb93', '#7d8fb3', '#b08a42', '#3f5585'];

/** Number that counts up from its previous value when it changes (new bookings arriving live). */
function CountUp({ value = 0 }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || start > value) { from.current = value; setShown(value); return undefined; }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 800);
      setShown(Math.round(start + (value - start) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString('en-IN')}</>;
}

function StatCard({ label, value, icon: Icon, color, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`card flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-ink-500 dark:text-ink-400">{label}</p>
        <p className="text-2xl font-bold text-ink-900 dark:text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-ink-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { selectedHotelId } = useHotel();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', selectedHotelId],
    queryFn: () => getDashboard(selectedHotelId).then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
    refetchInterval: 60000,
  });

  if (!selectedHotelId) {
    return <EmptyState title="No hotel selected" description="Select or create a hotel to see the dashboard." action={() => navigate('/admin/hotels')} actionLabel="Manage Hotels" />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard lines={8} />
          <SkeletonCard lines={8} />
        </div>
      </div>
    );
  }

  const stats = data?.counts || {};
  const month = data?.thisMonth || {};
  const monthlyData = data?.last6Months || [];
  const expenseByCategory = month.expensesByCategory || [];
  const rooms = data?.roomBoard || [];
  const totals = data?.bookings || {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header !flex-row !items-start">
        <div className="flex-1 min-w-0">
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{formatDate(new Date())}</p>
        </div>
        {/* Bookings ever made for this hotel; counts up live as new bookings arrive */}
        <button
          type="button"
          onClick={() => navigate('/admin/bookings?view=list')}
          title="Total bookings since start"
          className="flex items-center gap-2.5 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-3 py-2 hover:shadow-md transition-shadow flex-shrink-0"
        >
          <span className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center"><CalendarCheck className="w-4 h-4 text-white" /></span>
          <span className="text-left leading-tight">
            <span className="block text-xs text-ink-500 dark:text-ink-400">Total bookings</span>
            <span className="block text-lg font-bold text-ink-900 dark:text-white" data-testid="total-bookings"><CountUp value={totals.sinceStart ?? totals.total ?? 0} /></span>
          </span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Rooms" value={stats.totalRooms ?? 0} icon={BedDouble} color="bg-brand-600" />
        <StatCard label="Occupied" value={stats.occupied ?? 0} icon={Users} color="bg-rose-500" sub={stats.reserved ? `${stats.reserved} arriving today` : undefined} />
        <StatCard label="Available" value={stats.available ?? 0} icon={BedDouble} color="bg-emerald-500" />
        <StatCard label="Maintenance" value={stats.maintenance ?? 0} icon={BedDouble} color="bg-ink-500" />
        <StatCard label="Today's Check-ins" value={stats.todayCheckIns ?? 0} icon={LogIn} color="bg-blue-500" onClick={() => navigate('/admin/bookings')} />
        <StatCard label="Today's Check-outs" value={stats.todayCheckOuts ?? 0} icon={LogOut} color="bg-purple-500" onClick={() => navigate('/admin/inhouse')} />
        <StatCard label="Month Income" value={formatINR(month.income ?? 0)} icon={TrendingUp} color="bg-emerald-600" sub="This month" onClick={() => navigate('/admin/income')} />
        <StatCard label="Month Expenses" value={formatINR(month.expenses ?? 0)} icon={TrendingDown} color="bg-orange-500" sub={`Profit: ${formatINR(month.profit ?? 0)}`} onClick={() => navigate('/admin/expenses')} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="card">
          <h3 className="section-title mb-4">Income vs Expenses (last 6 months)</h3>
          {monthlyData.every((m) => !m.income && !m.expenses) ? (
            <div className="h-48 flex items-center justify-center text-ink-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#c9a45c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#5b7bb2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div className="card">
          <h3 className="section-title mb-4">Expenses by Category (this month)</h3>
          {expenseByCategory.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-ink-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}>
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Room Status Board */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Live Room Status</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(ROOM_STATUS_COLORS).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />{status}
              </span>
            ))}
          </div>
        </div>
        {rooms.length === 0 ? (
          <EmptyState title="No rooms yet" description="Add rooms to see the live status board." action={() => navigate('/admin/rooms')} actionLabel="Add Rooms" />
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
            {rooms.map((room) => (
              <div
                key={room._id || room.id}
                onClick={() => navigate(room.booking ? `/admin/bookings/${room.booking._id}` : '/admin/rooms')}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105 ${ROOM_STATUS_COLORS[room.liveStatus] || 'bg-ink-300'}`}
                title={`Room ${room.roomNumber} — ${room.liveStatus}${room.booking?.guest ? ` · ${room.booking.guest.name}` : ''}`}
              >
                <span className="text-white text-xs font-bold">{room.roomNumber}</span>
                {room.booking?.type && <span className="text-white/80 text-[9px]">{room.booking.type}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
