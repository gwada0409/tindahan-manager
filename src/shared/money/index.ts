export function formatCurrency(cents: number): string {
  if (!Number.isFinite(cents)) return '₱0.00';
  return `₱${(Math.round(cents) / 100).toFixed(2)}`;
}

export function parseCurrencyToCents(amount: string | number): number {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 100);
  }
  
  if (typeof amount !== 'string') return 0;
  
  const parsed = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
  if (isNaN(parsed) || !Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}
