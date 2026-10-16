import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getReportSummary, getYearlyReport } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { formatINR } from '../../utils/currency';
import { SkeletonCard } from '../../components/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';

// Brand series (same as the dashboard)
const PIE_COLORS = ['#c9a45c', '#5b7bb2', '#8a6a2c', '#e3cb93', '#7d8fb3', '#b08a42', '#3f5585'];

export default function Reports() {
  const { selectedHotelId } = useHotel();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['report-summary', selectedHotelId, from, to],
    queryFn: () => getReportSummary({ hotelId: selectedHotelId, from, to }).then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
  });

  const { data: yearly, isLoading: yearLoading } = useQuery({
    queryKey: ['report-yearly', selectedHotelId, year],
    queryFn: () => getYearlyReport({ hotelId: selectedHotelId, year }).then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
  });

  // Whole-year summary for the category breakdown and yearly occupancy
  const { data: yearSummary } = useQuery({
    queryKey: ['report-summary', selectedHotelId, `${year}-01-01`, `${year}-12-31`],
    queryFn: () =>
      getReportSummary({ hotelId: selectedHotelId, from: `${year}-01-01`, to: `${year}-12-31` }).then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
  });

  if (!selectedHotelId) return <div className="text-center py-16 text-ink-400">Select a hotel to view reports</div>;

  const monthlyData = yearly?.months || [];
  const hasYearData = monthlyData.some((m) => m.income || m.expenses);
  const expenseCategories = yearSummary?.expensesByCategory || [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
      </div>

      {/* Date range filter */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-400">
            <span>From</span>
            <input type="date" className="input w-auto" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            <span>To</span>
            <input type="date" className="input w-auto" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) ? (
            <button onClick={() => { setFrom(''); setTo(''); }} className="btn-ghost text-sm">Clear</button>
          ) : (
            <span className="text-xs text-ink-400">Showing this month</span>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      {sumLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Income', value: formatINR(summary.income || 0), color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Total Expenses', value: formatINR(summary.expenses || 0), color: 'text-red-500' },
            { label: 'Net Profit', value: formatINR(summary.profit || 0), color: (summary.profit || 0) >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500' },
            { label: 'Occupancy', value: `${(summary.occupancyPercent || 0).toFixed(1)}%`, color: 'text-blue-600 dark:text-blue-400' },
          ].map((item) => (
            <div key={item.label} className="card">
              <p className="text-sm text-ink-500">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Year selector for charts */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <h3 className="section-title flex-1">Year Overview</h3>
          <select className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {yearLoading ? (
          <div className="h-64 animate-pulse bg-ink-100 dark:bg-ink-700 rounded-xl" />
        ) : !hasYearData ? (
          <div className="h-48 flex items-center justify-center text-ink-400 text-sm">No data for {year}</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#c9a45c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#5b7bb2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Month-by-month table */}
      {hasYearData && (
        <div className="card">
          <h3 className="section-title mb-4">
            Month-by-Month Breakdown ({year})
            {yearSummary && <span className="text-sm font-normal text-ink-500 ml-2">· Occupancy {yearSummary.occupancyPercent.toFixed(1)}%</span>}
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Month</th><th>Income</th><th>Expenses</th><th>Profit</th></tr>
              </thead>
              <tbody>
                {monthlyData.map((row) => (
                  <tr key={row.month}>
                    <td className="font-medium text-ink-900 dark:text-white">{row.label}</td>
                    <td className="text-emerald-600 dark:text-emerald-400 font-medium">{formatINR(row.income || 0)}</td>
                    <td className="text-red-500 font-medium">{formatINR(row.expenses || 0)}</td>
                    <td className={`font-bold ${row.profit >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500'}`}>
                      {formatINR(row.profit || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expense by category pie */}
      {expenseCategories.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-4">Expense Breakdown by Category ({year})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={expenseCategories} dataKey="amount" nameKey="category" outerRadius={90} label={({ category, percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {expenseCategories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {expenseCategories.map((cat, i) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-sm text-ink-700 dark:text-ink-300 flex-1">{cat.category}</span>
                  <span className="text-sm font-semibold text-ink-900 dark:text-white">{formatINR(cat.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
