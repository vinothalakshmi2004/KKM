import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus, Search, Users, UserCog, Pencil, Trash2, Phone, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, dataOf } from '../../api/services';
import { useHotel } from '../../context/HotelContext';
import { useDebounce } from '../../hooks/useDebounce';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { SkeletonTable } from '../../components/Skeleton';
import { formatINR } from '../../utils/currency';
import { formatDate, toInputDate } from '../../utils/date';

// Suggestions in the Role box; any other role can be typed
const ROLES = ['Manager', 'Receptionist', 'Housekeeping', 'Room Boy', 'Cook', 'Security', 'Cleaner', 'Driver', 'Accountant', 'Maintenance'];
const ID_TYPES = ['Aadhaar', 'PAN', 'Driving License', 'Voter ID', 'Passport', 'Other'];

const EMPTY = {
  name: '', phone: '', email: '', role: '', salary: '', salaryType: 'Monthly', joinDate: '', status: 'Active',
  address: '', idProofType: '', idProofNumber: '', emergencyContact: '', bankDetails: '', notes: '',
};

function EmployeeModal({ hotelId, employee, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    employee
      ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, k === 'joinDate' ? toInputDate(employee.joinDate) : employee[k] ?? '']))
      : { ...EMPTY, joinDate: toInputDate(new Date()) }
  );
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, salary: form.salary === '' ? 0 : Number(form.salary), joinDate: form.joinDate || null };
      return (employee ? updateEmployee(employee._id, body) : createEmployee({ hotelId, ...body })).then(dataOf);
    },
    onSuccess: (e) => { toast.success(employee ? 'Employee updated' : `${e.name} added`); onSaved(); },
    onError: (err) => {
      const list = err.response?.data?.errors || [];
      if (list.length) setErrors(Object.fromEntries(list.map((x) => [x.field, x.message])));
      toast.error(err.response?.data?.message || 'Could not save employee');
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Name is required';
    if (form.phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter a valid phone number';
    if (form.role.trim().length < 2) errs.role = 'Role is required';
    if (form.salary !== '' && Number(form.salary) < 0) errs.salary = 'Salary cannot be negative';
    setErrors(errs);
    if (!Object.keys(errs).length) save.mutate();
  };

  const Field = ({ label, k, children, span }) => (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="label" htmlFor={`emp-${k}`}>{label}</label>
      {children}
      {errors[k] && <p className="form-error">{errors[k]}</p>}
    </div>
  );

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title={employee ? 'Edit Employee' : 'Add Employee'}
      subtitle={employee ? employee.name : 'Staff details, role and salary'}
      icon={UserCog}
      size="xl"
      onClose={onClose}
      busy={save.isPending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={save.isPending} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? 'Saving…' : employee ? 'Save Changes' : 'Add Employee'}</button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Field({ label: 'Full name *', k: 'name', children: <input id="emp-name" className="input" value={form.name} onChange={set('name')} maxLength={120} /> })}
        {Field({ label: 'Phone *', k: 'phone', children: <input id="emp-phone" className="input" value={form.phone} onChange={set('phone')} inputMode="tel" maxLength={16} /> })}
        {Field({
          label: 'Role *', k: 'role',
          children: (
            <>
              <input id="emp-role" className="input" list="emp-roles" value={form.role} onChange={set('role')} placeholder="Pick or type a role" maxLength={60} />
              <datalist id="emp-roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
            </>
          ),
        })}
        {Field({ label: 'Email', k: 'email', children: <input id="emp-email" type="email" className="input" value={form.email} onChange={set('email')} maxLength={120} /> })}
        {Field({
          label: 'Salary (₹)', k: 'salary',
          children: (
            <div className="flex gap-2">
              <input id="emp-salary" type="number" min={0} className="input flex-1" value={form.salary} onChange={set('salary')} placeholder="e.g. 15000" />
              <select className="input !w-32" value={form.salaryType} onChange={set('salaryType')} aria-label="Salary type">
                <option>Monthly</option>
                <option>Daily</option>
              </select>
            </div>
          ),
        })}
        {Field({ label: 'Joining date', k: 'joinDate', children: <input id="emp-joinDate" type="date" className="input" value={form.joinDate} onChange={set('joinDate')} /> })}
        {Field({
          label: 'Status', k: 'status',
          children: (
            <select id="emp-status" className="input" value={form.status} onChange={set('status')}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          ),
        })}
        {Field({ label: 'Emergency contact', k: 'emergencyContact', children: <input id="emp-emergencyContact" className="input" value={form.emergencyContact} onChange={set('emergencyContact')} placeholder="Name and phone" maxLength={120} /> })}
        {Field({
          label: 'ID proof', k: 'idProofType',
          children: (
            <select id="emp-idProofType" className="input" value={form.idProofType} onChange={set('idProofType')}>
              <option value="">Select…</option>
              {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          ),
        })}
        {Field({ label: 'ID proof number', k: 'idProofNumber', children: <input id="emp-idProofNumber" className="input" value={form.idProofNumber} onChange={set('idProofNumber')} maxLength={60} /> })}
        {Field({ label: 'Address', k: 'address', span: true, children: <textarea id="emp-address" rows={2} className="input resize-none" value={form.address} onChange={set('address')} maxLength={500} /> })}
        {Field({ label: 'Bank / UPI details (for salary)', k: 'bankDetails', span: true, children: <input id="emp-bankDetails" className="input" value={form.bankDetails} onChange={set('bankDetails')} placeholder="e.g. UPI 98xxxxxx@upi or A/c + IFSC" maxLength={300} /> })}
        {Field({ label: 'Notes', k: 'notes', span: true, children: <textarea id="emp-notes" rows={2} className="input resize-none" value={form.notes} onChange={set('notes')} maxLength={2000} /> })}
      </div>
    </Modal>
  );
}

const salaryText = (e) => (e.salary ? `${formatINR(e.salary)}${e.salaryType === 'Daily' ? ' / day' : ' / month'}` : '—');

export default function Employees() {
  const { selectedHotelId } = useHotel();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const search = useDebounce(filters.search);
  const [modal, setModal] = useState(null); // null | 'add' | employee
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', selectedHotelId, page, filters.role, filters.status, search],
    queryFn: () => getEmployees({ hotelId: selectedHotelId, page, limit: 20, search, role: filters.role, status: filters.status }).then(dataOf),
    enabled: !!selectedHotelId,
    placeholderData: keepPreviousData,
  });
  const items = data?.items || [];
  const pages = data?.pages ?? 1;
  const summary = data?.summary || {};

  useEffect(() => setPage(1), [selectedHotelId]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['employees'] });
  const remove = useMutation({
    mutationFn: (id) => deleteEmployee(id),
    onSuccess: () => { toast.success('Employee removed'); setDeleting(null); refresh(); },
    onError: () => toast.error('Could not remove employee'),
  });

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  if (!selectedHotelId) return <EmptyState title="No hotel selected" description="Select a hotel from the top bar." />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Staff of this hotel: role, salary and contact details.</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary"><Plus className="w-4 h-4" /> Add Employee</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <div className="card">
          <p className="text-sm text-ink-500 dark:text-ink-400 flex items-center gap-1.5"><Users className="w-4 h-4" /> Active staff</p>
          <p className="text-2xl font-bold text-ink-900 dark:text-white">{summary.active ?? 0}<span className="text-sm font-normal text-ink-500 dark:text-ink-400"> of {summary.total ?? 0}</span></p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-500 dark:text-ink-400 flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Monthly salary (active)</p>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{formatINR(summary.monthlySalary ?? 0)}</p>
          <p className="text-xs text-ink-400">Daily wages counted for 30 days</p>
        </div>
      </div>

      <div className="card mb-5">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input className="input pl-9" placeholder="Search name, phone or role…" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
          </div>
          <select className="input w-auto" value={filters.role} onChange={(e) => setFilter('role', e.target.value)}>
            <option value="">All Roles</option>
            {(data?.roles || []).map((r) => <option key={r}>{r}</option>)}
          </select>
          <select className="input w-auto" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet" description="Add your staff with their role and salary." action={() => setModal('add')} actionLabel="Add Employee" />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {items.map((e) => (
              <div key={e._id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900 dark:text-white">{e.name}</p>
                    <p className="text-sm text-ink-500 dark:text-ink-400">{e.role}</p>
                  </div>
                  <span className={`badge ${e.status === 'Active' ? 'badge-green' : 'badge-slate'}`}>{e.status}</span>
                </div>
                <div className="mt-2 text-sm space-y-0.5">
                  <a href={`tel:${e.phone}`} className="flex items-center gap-1.5 text-ink-600 dark:text-ink-300"><Phone className="w-3.5 h-3.5" /> {e.phone}</a>
                  <p className="font-semibold text-ink-900 dark:text-white">{salaryText(e)}</p>
                  {e.joinDate && <p className="text-xs text-ink-400">Joined {formatDate(e.joinDate)}</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setModal(e)} className="btn-secondary !py-1.5 text-xs"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  <button onClick={() => setDeleting(e)} className="btn-ghost !py-1.5 text-xs text-red-500"><Trash2 className="w-3.5 h-3.5" /> Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block table-container">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Role</th><th>Phone</th><th>Salary</th><th>Joined</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e._id}>
                    <td>
                      <p className="font-medium text-ink-900 dark:text-white">{e.name}</p>
                      {e.email && <p className="text-xs text-ink-400">{e.email}</p>}
                    </td>
                    <td>{e.role}</td>
                    <td className="whitespace-nowrap"><a href={`tel:${e.phone}`} className="hover:underline">{e.phone}</a></td>
                    <td className="whitespace-nowrap font-medium">{salaryText(e)}</td>
                    <td className="whitespace-nowrap">{e.joinDate ? formatDate(e.joinDate) : '—'}</td>
                    <td><span className={`badge ${e.status === 'Active' ? 'badge-green' : 'badge-slate'}`}>{e.status}</span></td>
                    <td className="whitespace-nowrap text-right">
                      <button onClick={() => setModal(e)} className="btn-ghost !p-2" aria-label={`Edit ${e.name}`}><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleting(e)} className="btn-ghost !p-2 text-red-500" aria-label={`Remove ${e.name}`}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </>
      )}

      {modal && (
        <EmployeeModal
          hotelId={selectedHotelId}
          employee={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refresh(); }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Remove employee?"
        message={`${deleting?.name} will be removed permanently. To keep their record, edit them and set Status to Inactive instead.`}
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => remove.mutate(deleting._id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
