import { getInvoicePdf } from '../api/services';

async function pdfUrl(id) {
  const res = await getInvoicePdf(id);
  return URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
}

/** Save the invoice PDF as "<invoiceNo>.pdf". */
export async function downloadInvoicePdf(invoice) {
  const url = await pdfUrl(invoice._id);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.invoiceNo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open the browser's print dialog for the invoice PDF (falls back to a new tab). */
export async function printInvoicePdf(invoice) {
  const url = await pdfUrl(invoice._id);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(url, '_blank', 'noopener');
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.appendChild(frame);
}
