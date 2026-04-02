// src/components/invoicing/format-currency.ts

/**
 * Formatea un monto en la moneda especificada.
 * HNL → "L 1,234.56"
 * USD → "$ 1,234.56"
 */
export function formatCurrency(amount: number, currencyCode: string = 'HNL'): string {
  const formatted = new Intl.NumberFormat('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  const symbol = currencyCode === 'USD' ? '$' : 'L';
  return `${symbol} ${formatted}`;
}

/**
 * Formatea un porcentaje. Ej: 0.15 → "15.00%"
 */
export function formatTaxRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}
