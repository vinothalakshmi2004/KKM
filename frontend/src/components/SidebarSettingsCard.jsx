import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, GripVertical, Lock, PanelLeft, RotateCcw, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { updatePreferences, dataOf } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { NAV_ITEMS, orderedNavItems } from '../layouts/navItems';

/**
 * Settings → Sidebar: the admin picks the order of the sidebar pages (arrows or drag) and which
 * ones are shown. Saved on the admin account, so it follows them to any device.
 */
export default function SidebarSettingsCard() {
  const { user, updateUser } = useAuth();
  const [items, setItems] = useState(() => orderedNavItems(user?.preferences?.sidebar));
  const [dragKey, setDragKey] = useState(null);

  // Saved layout changed elsewhere (another tab / device after reload)
  useEffect(() => {
    setItems(orderedNavItems(user?.preferences?.sidebar));
  }, [user?.preferences?.sidebar]);

  const saved = JSON.stringify(orderedNavItems(user?.preferences?.sidebar).map((i) => [i.to, i.hidden]));
  const dirty = JSON.stringify(items.map((i) => [i.to, i.hidden])) !== saved;

  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  };
  const toggle = (key) => setItems((list) => list.map((i) => (i.to === key && !i.locked ? { ...i, hidden: !i.hidden } : i)));

  const save = useMutation({
    mutationFn: (list) => updatePreferences({
      sidebar: { order: list.map((i) => i.to), hidden: list.filter((i) => i.hidden).map((i) => i.to) },
    }).then(dataOf),
    onSuccess: (u) => { updateUser({ ...user, ...u }); toast.success('Sidebar updated'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save the sidebar'),
  });

  const reset = () => setItems(NAV_ITEMS.map((i) => ({ ...i, hidden: false })));
  const shownCount = items.filter((i) => !i.hidden).length;

  return (
    <div className="card">
      <h3 className="section-title mb-1 flex items-center gap-2"><PanelLeft className="w-5 h-5 text-brand-600" /> Sidebar</h3>
      <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
        Choose the order of the menu and which pages it shows. Use the arrows or drag a row. Dashboard and Settings are always shown.
        Hidden pages still open from their links.
      </p>

      <ul className="rounded-xl border border-ink-200 dark:border-ink-700 divide-y divide-ink-100 dark:divide-ink-700" aria-label="Sidebar pages">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <li
              key={item.to}
              draggable
              onDragStart={(e) => { setDragKey(item.to); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { e.preventDefault(); if (dragKey && dragKey !== item.to) move(items.findIndex((x) => x.to === dragKey), i); }}
              onDragEnd={() => setDragKey(null)}
              className={`flex items-center gap-3 px-3 py-2 ${dragKey === item.to ? 'bg-brand-50 dark:bg-brand-900/20' : ''} ${item.hidden ? 'opacity-60' : ''}`}
              data-nav-row={item.label}
            >
              <GripVertical className="w-4 h-4 text-ink-400 cursor-grab flex-shrink-0 hidden sm:block" aria-hidden="true" />
              <span className="w-6 text-xs text-ink-400 text-right flex-shrink-0">{i + 1}</span>
              <Icon className="w-4 h-4 text-ink-600 dark:text-ink-300 flex-shrink-0" />
              <span className="flex-1 min-w-0 text-sm font-medium text-ink-900 dark:text-white truncate">{item.label}</span>
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="btn-ghost !p-1.5 disabled:opacity-30" aria-label={`Move ${item.label} up`}>
                <ArrowUp className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} className="btn-ghost !p-1.5 disabled:opacity-30" aria-label={`Move ${item.label} down`}>
                <ArrowDown className="w-4 h-4" />
              </button>
              {item.locked ? (
                <span className="w-[5.5rem] flex items-center justify-center gap-1 text-xs text-ink-500 dark:text-ink-400" title="Always shown"><Lock className="w-3.5 h-3.5" /> Always</span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(item.to)}
                  className={`w-[5.5rem] badge justify-center gap-1 !py-1 ${item.hidden ? 'badge-slate' : 'badge-green'}`}
                  aria-pressed={!item.hidden}
                  aria-label={`${item.hidden ? 'Show' : 'Hide'} ${item.label}`}
                >
                  {item.hidden ? <><EyeOff className="w-3.5 h-3.5" /> Hidden</> : <><Eye className="w-3.5 h-3.5" /> Shown</>}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <p className="text-xs text-ink-500 dark:text-ink-400">{shownCount} of {items.length} pages shown{dirty ? ' · not saved yet' : ''}</p>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="btn-ghost" disabled={save.isPending}><RotateCcw className="w-4 h-4" /> Default order</button>
          <button type="button" onClick={() => save.mutate(items)} disabled={!dirty || save.isPending} className="btn-primary">
            {save.isPending ? 'Saving…' : 'Save sidebar'}
          </button>
        </div>
      </div>
    </div>
  );
}
