import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBooking, updateBooking, checkinBooking, checkoutBooking, cancelBooking,
  createPayment, deletePayment, getDocuments, uploadDocument, deleteDocument, getDocumentFile
} from '../../api/services';
import { formatDate, formatDateTime, toInputDateTime, fromInputDateTime, diffNights } from '../../utils/date';
import { formatINR } from '../../utils/currency';
import ConfirmDialog from '../../components/ConfirmDialog';
import Modal from '../../components/Modal';
import FileUpload from '../../components/FileUpload';
import { SkeletonCard } from '../../components/Skeleton';
import {
  ChevronLeft, LogIn, LogOut, XCircle, Plus, Trash2,
  Download, FileText, Printer, CreditCard, Pencil, BadgeCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getInvoices, createInvoice, markOnlineBookingSeen, revealBookingAadhaar } from '../../api/services';
import OnlineTag from '../../components/OnlineTag';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

/** "2 Adults, 1 Child" */
export const partyText = (b) => {
  const a = b?.adults || 1;
  const c = b?.children || 0;
  return `${a} Adult${a === 1 ? '' : 's'}${c ? `, ${c} Child${c === 1 ? '' : 'ren'}` : ''}`;
};

const STATUS_BADGE = {
  Booked: 'badge-blue',
  'Checked-in': 'badge-green',
  'Checked-out': 'badge-slate',
  Cancelled: 'badge-red',
};

export function PaymentModal({ bookingId, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().slice(0, 10), mode: 'Cash', note: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createPayment(bookingId, form);
      toast.success('Payment recorded');
      onSaved();
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      as="form"
      onSubmit={handleSubmit}
      title="Add Payment"
      icon={CreditCard}
      size="md"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add Payment'}</button>
        </>
      }
    >
        <div className="space-y-4">
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} min={1} required />
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
              <option value="Bank">Bank Transfer</option>
            </select>
          </div>
          <div>
            <label className="label">Note</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
          </div>
        </div>
    </Modal>
  );
}

/** Record one payment for the whole remaining balance (uses the normal payment endpoint). */
function PayFullModal({ booking, onClose, onSaved }) {
  const [mode, setMode] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const amount = Math.round((booking.balance || 0) * 100) / 100;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createPayment(booking._id, { amount, mode, date: new Date().toISOString(), note: 'Paid in full' });
      toast.success(`${formatINR(amount)} received · booking fully paid`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record the payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title="Mark as Paid Fully"
      subtitle={`Booking ${booking.bookingNo}`}
      icon={BadgeCheck}
      size="sm"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Confirm Paid'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-ink-50 dark:bg-ink-700/50 p-4 text-sm space-y-1">
          <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Grand Total</span><span>{formatINR(booking.grandTotal)}</span></div>
          <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Already paid</span><span>{formatINR(booking.paidAmount)}</span></div>
          <div className="flex justify-between font-bold text-base text-ink-900 dark:text-white pt-1"><span>Receiving now</span><span>{formatINR(amount)}</span></div>
        </div>
        <div>
          <label className="label" htmlFor="pay-full-mode">Paid by</label>
          <select id="pay-full-mode" className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option>Cash</option>
            <option>UPI</option>
            <option>Card</option>
            <option value="Bank">Bank Transfer</option>
          </select>
        </div>
        <p className="text-xs text-ink-500 dark:text-ink-400">Recorded as one payment for today. The balance becomes ₹0.</p>
      </div>
    </Modal>
  );
}

function EditBookingModal({ booking, onClose, onSaved }) {
  const datesLocked = booking.status === 'Checked-out';
  // Arrival can only move before the guest has checked in
  const checkInEditable = booking.status === 'Booked';
  const [form, setForm] = useState({
    checkIn: toInputDateTime(booking.checkIn),
    checkOut: toInputDateTime(booking.checkOut),
    discount: booking.discount || 0,
    gstPercent: booking.gstPercent || 0,
    notes: booking.notes || '',
    adults: booking.adults || 1,
    children: booking.children || 0,
  });
  const [extras, setExtras] = useState(() => (booking.extraCharges || []).map((e) => ({ ...e })));
  const [saving, setSaving] = useState(false);

  // Preview only, from the per-night rates on the booking; the server recalculates
  const effectiveCheckIn = checkInEditable && form.checkIn ? fromInputDateTime(form.checkIn) : booking.checkIn;
  const newNights = form.checkOut ? diffNights(effectiveCheckIn, fromInputDateTime(form.checkOut)) : booking.nights;
  const roomTotal = (booking.rooms || []).reduce((s, r) => s + r.ratePerNight, 0) * newNights;
  const extrasTotal = extras.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const subtotal = roomTotal + extrasTotal - Number(form.discount);
  const grandTotal = subtotal * (1 + Number(form.gstPercent) / 100);
  const balance = grandTotal - (booking.paidAmount || 0);

  const setExtra = (i, key, value) => setExtras((list) => list.map((e, j) => (j === i ? { ...e, [key]: value } : e)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!datesLocked && new Date(fromInputDateTime(form.checkOut)) <= new Date(effectiveCheckIn)) {
      toast.error('Check-out must be after check-in');
      return;
    }
    if (subtotal < 0) {
      toast.error('Discount is more than the room total plus extras');
      return;
    }
    setSaving(true);
    try {
      await updateBooking(booking._id, {
        ...(datesLocked ? {} : { checkOut: fromInputDateTime(form.checkOut) }),
        ...(checkInEditable ? { checkIn: fromInputDateTime(form.checkIn) } : {}),
        extraCharges: extras
          .filter((x) => x.label.trim() && Number(x.amount) > 0)
          .map((x) => ({ label: x.label.trim(), amount: Number(x.amount) })),
        discount: Number(form.discount) || 0,
        gstPercent: Number(form.gstPercent) || 0,
        notes: form.notes,
        adults: Math.max(1, Number(form.adults) || 1),
        children: Math.max(0, Number(form.children) || 0),
      });
      toast.success('Booking updated');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update booking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      as="form"
      onSubmit={handleSubmit}
      title="Edit Booking"
      subtitle={booking.bookingNo}
      icon={Pencil}
      size="md"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
        </>
      }
    >
        <div className="space-y-4">
          {checkInEditable && (
            <div>
              <label className="label">Check-in Date & Time</label>
              <input type="datetime-local" className="input" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} required />
            </div>
          )}
          <div>
            <label className="label">Check-out Date & Time</label>
            <input type="datetime-local" className="input" value={form.checkOut} disabled={datesLocked} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} required />
            <p className="text-xs text-ink-400 mt-1">
              {newNights} night{newNights !== 1 ? 's' : ''}{datesLocked && ' · dates are fixed after check-out'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Adults</label>
              <input type="number" className="input" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} min={1} max={100} />
            </div>
            <div>
              <label className="label">Children</label>
              <input type="number" className="input" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} min={0} max={100} />
            </div>
          </div>

          <div>
            <label className="label">Extra Charges</label>
            <div className="space-y-2">
              {extras.map((x, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1" value={x.label} onChange={(e) => setExtra(i, 'label', e.target.value)} placeholder="e.g. Laundry" />
                  <input type="number" className="input w-28" value={x.amount} onChange={(e) => setExtra(i, 'amount', e.target.value)} min={0} />
                  <button type="button" onClick={() => setExtras((l) => l.filter((_, j) => j !== i))} className="btn-ghost p-2 text-ink-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setExtras((l) => [...l, { label: '', amount: '' }])} className="btn-ghost text-xs py-1">
                <Plus className="w-3.5 h-3.5" /> Add charge
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Discount (₹)</label>
              <input type="number" className="input" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} min={0} />
            </div>
            <div>
              <label className="label">GST (%)</label>
              <input type="number" className="input" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} min={0} max={100} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="bg-ink-50 dark:bg-ink-700/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>New Grand Total</span><span className="font-semibold">{formatINR(grandTotal)}</span></div>
            <div className={`flex justify-between font-semibold ${balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}><span>New Balance</span><span>{formatINR(balance)}</span></div>
          </div>
        </div>
    </Modal>
  );
}

export function CancelModal({ onClose, onConfirm, pending }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      title="Cancel Booking"
      subtitle="The rooms will be released. This cannot be undone."
      icon={XCircle}
      size="md"
      onClose={onClose}
      busy={pending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className="btn-secondary">Keep Booking</button>
          <button type="button" onClick={() => onConfirm(reason)} disabled={pending} className="btn-danger">
            {pending ? 'Cancelling…' : 'Cancel Booking'}
          </button>
        </>
      }
    >
      <label className="label">Reason</label>
      <textarea className="input resize-none" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional, e.g. guest changed plans" autoFocus />
    </Modal>
  );
}

/** "Generate invoice" or, once issued, "View invoice INV-…". */
function BookingInvoiceButton({ booking }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['booking-invoice', booking._id],
    queryFn: () =>
      getInvoices({ hotelId: booking.hotelId, bookingId: booking._id, status: 'Issued', limit: 1 })
        .then((r) => (r.data?.data?.items || [])[0] || null),
  });
  const issue = useMutation({
    mutationFn: () => createInvoice(booking._id),
    onSuccess: (res) => {
      const inv = res.data?.data;
      toast.success(`Invoice ${inv.invoiceNo} issued`);
      ['invoices', 'booking-invoice'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      navigate(`/admin/invoices/${inv._id}`);
    },
    onError: (err) => {
      const existing = err.response?.data?.errors?.[0]?.invoiceId;
      if (existing) navigate(`/admin/invoices/${existing}`);
      else toast.error(err.response?.data?.message || 'Could not generate the invoice');
    },
  });

  if (isLoading) return null;
  if (invoice) {
    return (
      <button onClick={() => navigate(`/admin/invoices/${invoice._id}`)} className="btn-secondary w-full justify-center">
        <FileText className="w-4 h-4" /> View invoice {invoice.invoiceNo}
      </button>
    );
  }
  if (booking.status === 'Cancelled') return null;
  return (
    <button onClick={() => issue.mutate()} disabled={issue.isPending} className="btn-secondary w-full justify-center">
      <FileText className="w-4 h-4" /> {issue.isPending ? 'Generating…' : 'Generate invoice'}
    </button>
  );
}

/** Masked Aadhaar with a confirmed, logged "Reveal" (the full number is only held in memory). */
function AadhaarRow({ booking }) {
  const [confirm, setConfirm] = useState(false);
  const [full, setFull] = useState('');
  const reveal = useMutation({
    mutationFn: () => revealBookingAadhaar(booking._id).then((r) => r.data?.data || r.data),
    onSuccess: (d) => { setFull(d.aadhaar); setConfirm(false); },
    onError: (err) => { setConfirm(false); toast.error(err.response?.data?.message || 'Could not reveal Aadhaar'); },
  });
  // Hide again after a minute
  useEffect(() => {
    if (!full) return undefined;
    const t = setTimeout(() => setFull(''), 60_000);
    return () => clearTimeout(t);
  }, [full]);

  const a = booking.guestAadhaar;
  if (!a) return null;
  return (
    <div className="col-span-2 sm:col-span-1">
      <p className="text-ink-400 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Aadhaar</p>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-medium text-ink-900 dark:text-white tracking-wider font-mono">{full || a.masked}</p>
        {a.canReveal && (full ? (
          <button type="button" onClick={() => setFull('')} className="btn-ghost !px-2 !py-1 text-xs no-print"><EyeOff className="w-3.5 h-3.5" /> Hide</button>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="btn-ghost !px-2 !py-1 text-xs no-print"><Eye className="w-3.5 h-3.5" /> Reveal</button>
        ))}
      </div>
      <ConfirmDialog
        open={confirm}
        danger={false}
        title="Reveal Aadhaar number?"
        message="The full Aadhaar number will be shown for one minute. Your name and the time are recorded each time it is revealed."
        confirmLabel="Reveal"
        loading={reveal.isPending}
        onConfirm={() => reveal.mutate()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentModal, setPaymentModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [docFiles, setDocFiles] = useState([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [payFullModal, setPayFullModal] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => getBooking(id).then((r) => r.data?.data || r.data),
  });

  // Opening an online booking marks it as seen
  const unseenOnline = booking?.source === 'Online' && booking?.seenByAdmin === false;
  useEffect(() => {
    if (!unseenOnline) return;
    markOnlineBookingSeen(id)
      .then(() => ['online-bookings', 'online-unseen'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })))
      .catch(() => {});
  }, [unseenOnline, id, queryClient]);

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', 'booking', id],
    queryFn: () => getDocuments({ ownerType: 'booking', ownerId: id }).then((r) => r.data?.data || r.data || []),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['booking', id] });
    ['bookings', 'dashboard', 'rooms', 'inhouse', 'payments'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const checkinMut = useMutation({
    mutationFn: () => checkinBooking(id),
    onSuccess: () => { toast.success('Checked in!'); invalidate(); },
    onError: () => toast.error('Check-in failed'),
  });

  const checkoutMut = useMutation({
    mutationFn: () => checkoutBooking(id),
    onSuccess: () => { toast.success('Checked out!'); invalidate(); },
    onError: () => toast.error('Check-out failed'),
  });

  const cancelMut = useMutation({
    mutationFn: (reason) => cancelBooking(id, { reason }),
    onSuccess: () => { toast.success('Booking cancelled'); setCancelModal(false); invalidate(); },
    onError: () => toast.error('Cancel failed'),
  });

  const delPaymentMut = useMutation({
    mutationFn: (pid) => deletePayment(pid),
    onSuccess: () => { toast.success('Payment deleted'); setDeletingPayment(null); invalidate(); },
    onError: () => toast.error('Failed to delete payment'),
  });

  const delDocMut = useMutation({
    mutationFn: (docId) => deleteDocument(docId),
    onSuccess: () => {
      toast.success('Document deleted');
      setDeletingDoc(null);
      queryClient.invalidateQueries({ queryKey: ['documents', 'booking', id] });
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const handleUploadDocs = async () => {
    if (!docFiles.length) return;
    setUploadingDocs(true);
    try {
      for (const file of docFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('ownerType', 'booking');
        fd.append('ownerId', id);
        await uploadDocument(fd);
      }
      toast.success('Documents uploaded');
      queryClient.invalidateQueries({ queryKey: ['documents', 'booking', id] });
      setDocFiles([]);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleDownload = async (docId, filename) => {
    try {
      const res = await getDocumentFile(docId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return <div className="space-y-4"><SkeletonCard lines={6} /><SkeletonCard lines={4} /></div>;
  }
  if (!booking) {
    return <div className="text-center py-16 text-ink-400">Booking not found</div>;
  }

  const payments = booking.payments || [];
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const guest = booking.guestId || {};

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/bookings')} className="btn-ghost p-2"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="page-title">Booking {booking.bookingNo}</h1>
          <span className={`badge ${STATUS_BADGE[booking.status] || 'badge-slate'} mt-1`}>{booking.status}</span>
          {booking.source === 'Online' && (
            <>
              <OnlineTag className="ml-2 mt-1" />
              <span className="ml-2 text-xs text-ink-500 dark:text-ink-400">{booking.onlineRef} · {booking.online?.paymentStatus || 'Pay at hotel'}</span>
            </>
          )}
        </div>
        <button onClick={handlePrint} className="btn-ghost gap-2 hidden sm:flex no-print"><Printer className="w-4 h-4" /> Print</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Booking info */}
          <div className="card">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Booking Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-ink-400">Guest</p>
                <p className="font-medium text-ink-900 dark:text-white">{guest.name}</p>
                <p className="text-ink-500">{guest.phone}</p>
              </div>
              <div>
                <p className="text-ink-400">Rooms</p>
                <p className="font-medium text-ink-900 dark:text-white">
                  {(booking.rooms || []).map((r) => `Room ${r.roomNumber} (${r.type}) · ${formatINR(r.ratePerNight)}/night`).join(', ')}
                </p>
              </div>
              <div>
                <p className="text-ink-400">Check-in</p>
                <p className="font-medium text-ink-900 dark:text-white">{formatDateTime(booking.checkIn)}</p>
              </div>
              <div>
                <p className="text-ink-400">Check-out</p>
                <p className="font-medium text-ink-900 dark:text-white">{formatDateTime(booking.checkOut)}</p>
              </div>
              <div>
                <p className="text-ink-400">Guests staying</p>
                <p className="font-medium text-ink-900 dark:text-white">{partyText(booking)} · {(booking.adults || 1) + (booking.children || 0)} total</p>
              </div>
              <div>
                <p className="text-ink-400">Nights</p>
                <p className="font-medium text-ink-900 dark:text-white">{booking.nights}</p>
              </div>
              {guest.idProofType && !booking.guestAadhaar && (
                <div>
                  <p className="text-ink-400">ID Proof</p>
                  <p className="font-medium text-ink-900 dark:text-white">{guest.idProofType}: {guest.idProofNumber}</p>
                </div>
              )}
              <AadhaarRow booking={booking} />
            </div>
          </div>

          {/* Amount */}
          <div className="card">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Amount</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-ink-600 dark:text-ink-300">
                <span>Room Total ({booking.nights} night{booking.nights !== 1 ? 's' : ''})</span><span>{formatINR(booking.roomTotal)}</span>
              </div>
              {(booking.extraCharges || []).map((x, i) => (
                <div key={i} className="flex justify-between text-ink-600 dark:text-ink-300">
                  <span>{x.label}</span><span>+ {formatINR(x.amount)}</span>
                </div>
              ))}
              {booking.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span><span>- {formatINR(booking.discount)}</span>
                </div>
              )}
              {booking.gstPercent > 0 && (
                <div className="flex justify-between text-ink-600 dark:text-ink-300">
                  <span>GST ({booking.gstPercent}%)</span><span>+ {formatINR(booking.gstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-ink-900 dark:text-white border-t border-ink-200 dark:border-ink-700 pt-2">
                <span>Grand Total</span><span className="text-brand-600 dark:text-brand-400">{formatINR(booking.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Total Paid</span><span>{formatINR(totalPaid)}</span>
              </div>
              <div className={`flex justify-between font-bold text-base ${(booking.balance || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                <span>Balance Due</span><span>{formatINR(booking.balance || 0)}</span>
              </div>
            </div>
          </div>

          {/* Payment history */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink-900 dark:text-white">Payment History</h3>
              <button onClick={() => setPaymentModal(true)} className="btn-primary py-1.5 text-xs no-print">
                <Plus className="w-3.5 h-3.5" /> Add Payment
              </button>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-ink-400 italic">No payments recorded yet</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p._id || p.id} className="flex items-center gap-3 p-3 bg-ink-50 dark:bg-ink-700/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink-900 dark:text-white">{formatINR(p.amount)}</p>
                      <p className="text-xs text-ink-400">{formatDate(p.date)} · {p.mode} {p.note && `· ${p.note}`}</p>
                    </div>
                    <button onClick={() => setDeletingPayment(p)} className="text-ink-300 hover:text-red-500 transition-colors no-print">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="card">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Documents</h3>
            {documents.length > 0 && (
              <div className="space-y-2 mb-4">
                {documents.map((doc) => (
                  <div key={doc._id || doc.id} className="flex items-center gap-3 p-3 bg-ink-50 dark:bg-ink-700/50 rounded-lg">
                    <FileText className="w-5 h-5 text-ink-400" />
                    <span className="flex-1 text-sm text-ink-700 dark:text-ink-300 truncate">{doc.originalName || 'Document'}</span>
                    <button onClick={() => handleDownload(doc._id, doc.originalName)} className="text-brand-600 hover:text-brand-700">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeletingDoc(doc)} className="text-ink-300 hover:text-red-500 no-print">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="no-print">
              <FileUpload onFiles={setDocFiles} multiple />
              {docFiles.length > 0 && (
                <button onClick={handleUploadDocs} disabled={uploadingDocs} className="btn-primary mt-3">
                  {uploadingDocs ? 'Uploading…' : `Upload ${docFiles.length} file(s)`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Actions sidebar */}
        <div className="space-y-5">
          <div className="card no-print">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-4">Actions</h3>
            <div className="space-y-2">
              {booking.status !== 'Cancelled' && (booking.balance || 0) > 0 && (
                <button onClick={() => setPayFullModal(true)} className="btn-primary w-full justify-center bg-emerald-700 hover:bg-emerald-800">
                  <BadgeCheck className="w-4 h-4" /> Paid Fully · {formatINR(booking.balance)}
                </button>
              )}
              {booking.status !== 'Cancelled' && (booking.grandTotal || 0) > 0 && (booking.balance || 0) <= 0 && (
                <div className="badge-green w-full justify-center !py-2 !text-sm gap-1.5"><BadgeCheck className="w-4 h-4" /> Fully paid</div>
              )}
              <BookingInvoiceButton booking={booking} />
              {booking.status !== 'Cancelled' && (
                <button onClick={() => setEditModal(true)} className="btn-secondary w-full justify-center">
                  <Pencil className="w-4 h-4" /> {booking.status === 'Booked' ? 'Edit Dates / Charges' : 'Edit / Extend Stay'}
                </button>
              )}
              {booking.status === 'Booked' && (
                <button
                  onClick={() => checkinMut.mutate()}
                  disabled={checkinMut.isPending}
                  className="btn-primary w-full justify-center"
                >
                  <LogIn className="w-4 h-4" /> Check In
                </button>
              )}
              {booking.status === 'Checked-in' && (
                <button
                  onClick={() => checkoutMut.mutate()}
                  disabled={checkoutMut.isPending}
                  className="btn-secondary w-full justify-center"
                >
                  <LogOut className="w-4 h-4" /> Check Out
                </button>
              )}
              {booking.status === 'Booked' && (
                <button
                  onClick={() => setCancelModal(true)}
                  className="btn-danger w-full justify-center"
                >
                  <XCircle className="w-4 h-4" /> Cancel Booking
                </button>
              )}
            </div>
          </div>

          {/* Guest summary */}
          <div className="card">
            <h3 className="font-semibold text-ink-900 dark:text-white mb-3">Guest</h3>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-ink-900 dark:text-white">{guest.name}</p>
              <p className="text-ink-500">{guest.phone}</p>
              {guest.email && <p className="text-ink-500">{guest.email}</p>}
              {guest.address && <p className="text-ink-500 text-xs">{guest.address}</p>}
              <button
                onClick={() => navigate(`/admin/guests/${guest._id}`)}
                className="text-brand-600 text-xs hover:underline mt-2 block"
              >
                View full guest profile →
              </button>
            </div>
          </div>
        </div>
      </div>

      {payFullModal && (
        <PayFullModal booking={booking} onClose={() => setPayFullModal(false)} onSaved={() => { setPayFullModal(false); invalidate(); }} />
      )}

      {paymentModal && (
        <PaymentModal bookingId={id} onClose={() => setPaymentModal(false)} onSaved={() => { setPaymentModal(false); invalidate(); }} />
      )}

      {editModal && (
        <EditBookingModal booking={booking} onClose={() => setEditModal(false)} onSaved={() => { setEditModal(false); invalidate(); }} />
      )}

      {cancelModal && (
        <CancelModal onClose={() => setCancelModal(false)} onConfirm={(reason) => cancelMut.mutate(reason)} pending={cancelMut.isPending} />
      )}

      <ConfirmDialog
        open={!!deletingDoc}
        title="Delete Document"
        message={`Delete ${deletingDoc?.filename || deletingDoc?.originalName || 'this document'}?`}
        onConfirm={() => delDocMut.mutate(deletingDoc._id || deletingDoc.id)}
        loading={delDocMut.isPending}
        onCancel={() => setDeletingDoc(null)}
      />

      <ConfirmDialog
        open={!!deletingPayment}
        title="Delete Payment"
        message={`Delete payment of ${formatINR(deletingPayment?.amount)}?`}
        onConfirm={() => delPaymentMut.mutate(deletingPayment._id || deletingPayment.id)}
        loading={delPaymentMut.isPending}
        onCancel={() => setDeletingPayment(null)}
      />
    </div>
  );
}
