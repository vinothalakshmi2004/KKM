// Quote every cell so commas, quotes and newlines in notes/names don't break columns
const escapeCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export const downloadCSV = (filename, rows) => {
  // BOM so Excel opens it as UTF-8 (₹, Tamil names)
  const csv = '\uFEFF' + rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // In the page and revoked a moment later, so every browser has time to start the download
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
