import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getExpenses, createExpense, updateExpense, deleteExpense,
  getExpenseCategories, createExpenseCategory, deleteExpenseCategory, listOf, fetchAllPages
} from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { formatDate, toInputDate, now } from '../../utils/date';
import { downloadCSV } from '../../utils/csv';
import { formatINR } from '../../utils/currency';
import { SkeletonTable } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import FileUpload from '../../components/FileUpload';
import { Plus, Edit2, Trash2, X, Download, Receipt, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import ScreenOverlay from '../../components/ScreenOverlay';

const DEFAULT_CATEGORIES = ['Pantry items', 'Maintenance', 'Cleaning', 'Staff salary', 'Electricity', 'Cable TV', 'Water', 'Other'];

function ExpenseModal({ expense, hotelId, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    date: expense?.date ? toInputDate(expense.date) : now().format('YYYY-MM-DD'),
    category: expense?.categoryName || categories[0] || '',
    amount: expense?.amount || '',
    paidTo: expense?.paidTo || '',
    paymentMode: expense?.paymentMode || 'Cash',
    note: expense?.note || '',
  });
  const [billFile, setBillFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries({ ...form, hotelId }).forEach(([k, v]) => v !== undefined && fd.append(k, v));
      if (billFile) fd.append('bill', billFile);
      if (expense) await updateExpense(expense._id || expense.id, fd);
      else await createExpense(fd);
      toast.success(expense ? 'Expense updated' : 'Expense added');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenOverlay>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">{expense ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} min={0} required />
            </div>
          </div>
          <div>
            <label className="label">Category *</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Paid To</label>
            <input className="input" value={form.paidTo} onChange={(e) => setForm({ ...form, paidTo: e.target.value })} placeholder="Vendor name" />
          </div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="input" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
              <option>Cash</option><option>UPI</option><option>Card</option><option value="Bank">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="label">Note</label>
            <textarea className="input resize-none" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div>
            <label className="label">Bill (optional)</label>
            <FileUpload onFiles={(f) => setBillFile(f[0])} multiple={false} label="Upload bill" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : (expense ? 'Save Changes' : 'Add Expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ScreenOverlay>
  );
}

function CategoryManager({ hotelId, categories, onClose }) {
  const [newCat, setNewCat] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const addCat = async () => {
    if (!newCat.trim()) return;
    setSaving(true);
    try {
      await createExpenseCategory({ name: newCat.trim(), hotelId });
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      setNewCat('');
      toast.success('Category added');
    } catch {
      toast.error('Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  const delCat = async (id) => {
    try {
      await deleteExpenseCategory(id);
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast.success('Category deleted');
    } catch {
      toast.error('Cannot delete — expenses may be using this category');
    }
  };

  return (
    <ScreenOverlay>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">Manage Categories</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <input className="input flex-1" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} placeholder="New category name" />
          <button onClick={addCat} disabled={saving} className="btn-primary">Add</button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {categories.map((c) => (
            <div key={c._id || c.id || c.name || c} className="flex items-center justify-between p-2.5 bg-ink-50 dark:bg-ink-700/50 rounded-lg">
              <span className="text-sm text-ink-700 dark:text-ink-300">{c.name || c}</span>
              {(c._id || c.id) && (
                <button onClick={() => delCat(c._id || c.id)} className="text-ink-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
    </ScreenOverlay>
  );
}

export default function Expenses() {
  const { selectedHotelId } = useHotel();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ from: '', to: '', category: '' });

  useEffect(() => setPage(1), [selectedHotelId, filters]);
  const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', selectedHotelId, filters, page],
    queryFn: () =>
      getExpenses({ hotelId: selectedHotelId, ...cleanFilters, page, limit: 20 })
        .then((r) => r.data?.data || r.data),
    enabled: !!selectedHotelId,
  });

  const { data: catData = [] } = useQuery({
    queryKey: ['expense-categories', selectedHotelId],
    queryFn: () => getExpenseCategories(selectedHotelId).then(listOf),
    enabled: !!selectedHotelId,
  });

  const expenses = data?.items || data || [];
  const pages = data?.pages ?? Math.max(1, Math.ceil((data?.total || 0) / 20));
  // Prefer the server's total across all pages; summing rows only covers this page
  const serverTotal = data?.totalAmount;
  const total = serverTotal ?? expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalLabel = serverTotal == null && pages > 1 ? 'Total (this page)' : 'Total';

  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const allCategories = catData.length ? catData.map((c) => c.name) : DEFAULT_CATEGORIES;

  const deleteMut = useMutation({
    mutationFn: (id) => deleteExpense(id),
    onSuccess: () => {
      ['expenses', 'dashboard', 'report-summary'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success('Expense deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Failed to delete expense'),
  });

  const [exporting, setExporting] = useState(false);
  const exportCSV = async () => {
    setExporting(true);
    try {
      // Export every matching expense, not just the visible page
      const all = await fetchAllPages(getExpenses, { hotelId: selectedHotelId, ...cleanFilters });
      const rows = [['Date', 'Category', 'Amount', 'Paid To', 'Mode', 'Note']];
      all.forEach((e) => rows.push([formatDate(e.date), e.categoryName, e.amount, e.paidTo || '', e.paymentMode, e.note || '']));
      downloadCSV('expenses.csv', rows);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (!selectedHotelId) return <EmptyState title="No hotel selected" />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Expenses</h1>
        <div className="flex gap-2">
          <button onClick={() => setCatModal(true)} className="btn-ghost"><Settings className="w-4 h-4" /> Categories</button>
          <button onClick={exportCSV} disabled={exporting} className="btn-secondary"><Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export'}</button>
          <button onClick={() => setModal('add')} className="btn-primary"><Plus className="w-4 h-4" /> Add Expense</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex flex-wrap gap-3 items-center">
          <select className="input w-auto" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" className="input w-auto" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <span className="text-ink-400 text-sm">to</span>
          <input type="date" className="input w-auto" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ from: '', to: '', category: '' })} className="btn-ghost text-sm">Clear</button>
          )}
          <div className="flex-1" />
          <div className="text-right">
            <p className="text-xs text-ink-500">{totalLabel}</p>
            <p className="font-bold text-red-500 text-lg">{formatINR(total)}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses found" action={() => setModal('add')} actionLabel="Add Expense" />
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden space-y-3">
            {expenses.map((e) => (
              <div key={e._id || e.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="badge badge-red">{e.categoryName}</span>
                    <p className="font-bold text-ink-900 dark:text-white text-lg mt-1">{formatINR(e.amount)}</p>
                    <p className="text-sm text-ink-500">{formatDate(e.date)} · {e.paymentMode}</p>
                    {e.paidTo && <p className="text-xs text-ink-400">Paid to: {e.paidTo}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setModal(e)} className="btn-ghost p-2"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeleting(e)} className="btn-ghost p-2 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block table-container">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Category</th><th>Amount</th><th>Paid To</th><th>Mode</th><th>Note</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e._id || e.id}>
                    <td>{formatDate(e.date)}</td>
                    <td><span className="badge badge-slate">{e.categoryName}</span></td>
                    <td className="font-semibold text-red-500">{formatINR(e.amount)}</td>
                    <td>{e.paidTo || '—'}</td>
                    <td>{e.paymentMode}</td>
                    <td className="text-ink-500 max-w-[8rem] truncate">{e.note || '—'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => setModal(e)} className="btn-ghost p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleting(e)} className="btn-ghost p-1.5 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </>
      )}

      {(modal === 'add' || modal?._id || modal?.id) && (
        <ExpenseModal
          expense={modal === 'add' ? null : modal}
          hotelId={selectedHotelId}
          categories={allCategories}
          onClose={() => setModal(null)}
          onSaved={() => { ['expenses', 'dashboard', 'report-summary'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })); setModal(null); }}
        />
      )}
      {catModal && (
        <CategoryManager hotelId={selectedHotelId} categories={catData} onClose={() => setCatModal(false)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete Expense"
        message={`Delete ${deleting?.categoryName} expense of ${formatINR(deleting?.amount)}?`}
        onConfirm={() => deleteMut.mutate(deleting._id || deleting.id)}
        loading={deleteMut.isPending}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
