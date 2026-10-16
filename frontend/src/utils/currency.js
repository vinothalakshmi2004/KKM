/**
 * Format a number as Indian currency: ₹1,25,000
 */
export const formatINR = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  const num = Number(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

/**
 * Format number with Indian grouping (no currency symbol)
 */
export const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  return new Intl.NumberFormat('en-IN').format(Number(num));
};
