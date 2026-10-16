import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Download, Printer, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getInvoice, cancelInvoice } from '../../api/services';
import { SkeletonCard } from '../../components/Skeleton';
import Modal from '../../components/Modal';
import { formatDate, formatDateTime } from '../../utils/date';
import { formatINR } from '../../utils/currency';
import { downloadInvoicePdf, printInvoicePdf } from '../../utils/invoicePdf';
import { INVOICE_BADGE } from './Invoices';

function CancelInvoiceModal({ invoice, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () => cancelInvoice(invoice._id, { reason }),
    onSuccess: () => { toast.success(`Invoice ${invoice.invoiceNo} cancelled`); onDone(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to cancel invoice'),
  });
  return (
    <Modal
      title="Cancel Invoice"
      subtitle={`${invoice.invoiceNo} will be marked cancelled. You can issue a new invoice for the booking afterwards.`}
      icon={XCircle}
      size="md"
      onClose={onClose}
      busy={mutation.isPending}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>Keep Invoice</button>
          <button type="button" className="btn-danger" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Cancelling…' : 'Cancel Invoice'}
          </button>
        </>
      }
    >
      <label className="label">Reason</label>
      <textarea className="input resize-none" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional, e.g. wrong guest details" />
    </Modal>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const { data: inv, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id).then((r) => r.data?.data || r.data),
  });

  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn(inv);
    } catch {
      toast.error('Could not load the PDF. Please try again.');
    } finally {
      setBusy('');
    }
  };

  if (isLoading) return <div className="space-y-4"><SkeletonCard lines={6} /><SkeletonCard lines={6} /></div>;
  if (!inv) return <div className="text-center py-16 text-ink-400">Invoice not found</div>;

  const h = inv.hotel || {};
  const g = inv.guest || {};
  const s = inv.stay || {};

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate('/admin/invoices')} className="btn-ghost p-2" aria-label="Back to invoices"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="page-title">{inv.invoiceNo}</h1>
          <span className={`badge ${INVOICE_BADGE[inv.status] || 'badge-slate'} mt-1`}>{inv.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => run('download', downloadInvoicePdf)} disabled={!!busy} className="btn-primary">
            <Download className="w-4 h-4" /> {busy === 'download' ? 'Preparing…' : 'Download PDF'}
          </button>
          <button onClick={() => run('print', printInvoicePdf)} disabled={!!busy} className="btn-secondary">
            <Printer className="w-4 h-4" /> {busy === 'print' ? 'Preparing…' : 'Print'}
          </button>
          <button onClick={() => navigate(`/admin/bookings/${inv.bookingId}`)} className="btn-secondary">
            <ExternalLink className="w-4 h-4" /> View booking
          </button>
          {inv.status === 'Issued' && (
            <button onClick={() => setCancelOpen(true)} className="btn-danger">
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      </div>

      {inv.outdated && (
        <div className="card flex items-start gap-3">
          <span className="badge badge-yellow flex-shrink-0"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Booking changed</span>
          <p className="text-sm text-ink-600 dark:text-ink-300">
            The booking was edited after this invoice was issued, so the invoice may not match it any more.
            To update it, cancel this invoice and generate a new one from the booking.
          </p>
        </div>
      )}
      {inv.status === 'Cancelled' && (
        <div className="card flex items-start gap-3">
          <span className="badge badge-red flex-shrink-0">Cancelled</span>
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Cancelled on {formatDateTime(inv.cancelledAt)}{inv.cancelReason ? `: ${inv.cancelReason}` : ''}
          </p>
        </div>
      )}

      {/* Preview */}
      <div className="card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-5 border-b border-ink-100 dark:border-ink-700">
          <div>
            <p className="text-xl font-bold text-ink-900 dark:text-white">{h.name}</p>
            <p className="text-sm text-ink-500 dark:text-ink-400">{[h.address, h.area, h.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</p>
            <p className="text-sm text-ink-500 dark:text-ink-400">{[h.phone, h.email].filter(Boolean).join(' · ')}</p>
            {h.gstin && <p className="text-sm text-ink-500 dark:text-ink-400">GSTIN: {h.gstin}</p>}
          </div>
          <div className="sm:text-right text-sm">
            <p className="text-lg font-bold text-ink-900 dark:text-white">{inv.gstPercent > 0 ? 'TAX INVOICE' : 'INVOICE'}</p>
            <p className="text-ink-500 dark:text-ink-400">Date: <span className="font-medium text-ink-900 dark:text-white">{formatDate(inv.issuedAt)}</span></p>
            <p className="text-ink-500 dark:text-ink-400">Booking: <span className="font-medium text-ink-900 dark:text-white">{s.bookingNo}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1">Billed to</p>
            <p className="font-semibold text-ink-900 dark:text-white">{g.name}</p>
            {g.phone && <p className="text-ink-600 dark:text-ink-300">{g.phone}</p>}
            {g.email && <p className="text-ink-600 dark:text-ink-300">{g.email}</p>}
            {g.address && <p className="text-ink-600 dark:text-ink-300">{g.address}</p>}
            {g.idProofType && <p className="text-ink-600 dark:text-ink-300">{g.idProofType} {g.idProofNumber}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1">Stay</p>
            <p className="text-ink-600 dark:text-ink-300">Check-in: <span className="text-ink-900 dark:text-white">{formatDateTime(s.checkIn)}</span></p>
            <p className="text-ink-600 dark:text-ink-300">Check-out: <span className="text-ink-900 dark:text-white">{formatDateTime(s.checkOut)}</span></p>
            <p className="text-ink-600 dark:text-ink-300">Nights: <span className="text-ink-900 dark:text-white">{s.nights}</span></p>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Description</th><th className="!text-right">Qty</th><th className="!text-right">Rate</th><th className="!text-right">Amount</th></tr>
            </thead>
            <tbody>
              {(inv.lines || []).map((l, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{l.description}</td>
                  <td className="text-right">{l.qty}</td>
                  <td className="text-right">{formatINR(l.rate)}</td>
                  <td className="text-right font-medium">{formatINR(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-6 sm:justify-between">
          <div className="text-sm space-y-1 sm:max-w-xs">
            {inv.payments?.length > 0 && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-1">Payments received</p>
                {inv.payments.map((p, i) => (
                  <div key={i} className="flex justify-between gap-6 text-ink-600 dark:text-ink-300">
                    <span>{formatDate(p.date)} · {p.mode}</span><span>{formatINR(p.amount)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="text-sm space-y-1.5 sm:w-72">
            <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Subtotal</span><span>{formatINR(inv.subtotal)}</span></div>
            {inv.discount > 0 && <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Discount</span><span>− {formatINR(inv.discount)}</span></div>}
            <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Taxable value</span><span>{formatINR(inv.taxableValue)}</span></div>
            {inv.gstPercent > 0 && (
              <>
                <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>CGST @ {inv.gstPercent / 2}%</span><span>{formatINR(inv.cgst)}</span></div>
                <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>SGST @ {inv.gstPercent / 2}%</span><span>{formatINR(inv.sgst)}</span></div>
              </>
            )}
            <div className="flex justify-between font-bold text-base text-ink-900 dark:text-white border-t border-ink-200 dark:border-ink-700 pt-2">
              <span>Grand Total</span><span>{formatINR(inv.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatINR(inv.paidAmount)}</span></div>
            <div className={`flex justify-between font-semibold ${inv.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              <span>Balance due</span><span>{formatINR(inv.balance)}</span>
            </div>
          </div>
        </div>
      </div>

      {cancelOpen && (
        <CancelInvoiceModal
          invoice={inv}
          onClose={() => setCancelOpen(false)}
          onDone={() => {
            setCancelOpen(false);
            ['invoice', 'invoices', 'booking-invoice'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
          }}
        />
      )}
    </div>
  );
}
