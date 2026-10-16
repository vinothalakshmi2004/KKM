import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  
  const getPages = () => {
    const range = [];
    const delta = 2;
    const left = Math.max(1, page - delta);
    const right = Math.min(pages, page + delta);
    
    if (left > 1) { range.push(1); if (left > 2) range.push('...'); }
    for (let i = left; i <= right; i++) range.push(i);
    if (right < pages) { if (right < pages - 1) range.push('...'); range.push(pages); }
    
    return range;
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        className="btn-ghost p-2"
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {getPages().map((p, i) => (
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-ink-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
              p === page
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700'
            }`}
          >
            {p}
          </button>
        )
      ))}
      <button
        className="btn-ghost p-2"
        onClick={() => onPage(page + 1)}
        disabled={page === pages}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
