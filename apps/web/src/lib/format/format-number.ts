const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

/**
 * Formats an integer-ish number for UI.
 * Keeps formatting consistent across the app.
 */
export function formatNumber(value: number): string {
  // Guard against NaN/infinities silently leaking into UI.
  if (!Number.isFinite(value)) return '—';
  return integerFormatter.format(value);
}
