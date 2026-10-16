import { AlertTriangle, HelpCircle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = true, loading = false, confirmLabel = 'Confirm' }) {
  if (!open) return null;

  return (
    <Modal
      title={title}
      icon={danger ? AlertTriangle : HelpCircle}
      size="sm"
      onClose={onCancel}
      busy={loading}
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-600 dark:text-ink-300">{message}</p>
    </Modal>
  );
}
