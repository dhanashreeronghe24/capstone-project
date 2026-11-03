const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formats an amount as Indian rupees, e.g. `₹1,299.00` (lakh/crore grouping: `₹12,34,567.00`). */
export function formatINR(amount: number, options: { hideZeroDecimals?: boolean } = {}): string {
  if (!Number.isFinite(amount)) return inrFormatter.format(0);
  if (options.hideZeroDecimals && Number.isInteger(amount)) return inrWholeFormatter.format(amount);
  return inrFormatter.format(amount);
}

/** Rounds to 2 decimals using integer paise to avoid floating-point drift (0.1 + 0.2). */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Percentage saved between list price and price, or 0 when there is no real discount. */
export function discountPercent(price: number, listPrice: number | null | undefined): number {
  if (!listPrice || listPrice <= price) return 0;
  return Math.round(((listPrice - price) / listPrice) * 100);
}
