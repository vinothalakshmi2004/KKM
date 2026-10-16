import { InboxIcon } from 'lucide-react';

export default function EmptyState({ icon: Icon = InboxIcon, title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-brand-500" />
      </div>
      <h3 className="text-base font-semibold text-ink-900 dark:text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-ink-500 dark:text-ink-400 max-w-xs mb-4">{description}</p>
      )}
      {action && (
        <button className="btn-primary" onClick={action}>
          {actionLabel || 'Get started'}
        </button>
      )}
    </div>
  );
}
