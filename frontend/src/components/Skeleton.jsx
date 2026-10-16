export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card space-y-3">
      <div className="skeleton h-5 w-3/4 rounded" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div key={i} className="skeleton h-4 rounded" style={{ width: `${60 + (i % 3) * 15}%` }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><div className="skeleton h-4 w-20 rounded" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><div className="skeleton h-4 rounded" style={{ width: `${50 + c * 10}%` }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={4} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 1 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-4 rounded" style={{ width: i % 2 === 0 ? '80%' : '60%' }} />
      ))}
    </div>
  );
}
