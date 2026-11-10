/**
 * Orientation annuity for buy listings — 100 % financing, so the monthly
 * rate is an upper bound (Eigenkapital only lowers it).
 *
 * 20-year fix in Austria ≈ 3.50–3.75 % p.a. (infina.at Fixzins overview,
 * Stand 07/2026; Bank Austria WohnKredit ab 3,55 %) → default 3.60 %.
 * Display always carries the disclaimer — real terms depend on the bank.
 */
export const ANNUITY_RATE_PCT = 3.6;
export const ANNUITY_YEARS = 20;

/** Monthly annuity (principal + interest) over `years`; null without a price. */
export function monthlyRate(
  priceEur: number | null,
  annualPct: number = ANNUITY_RATE_PCT,
  years: number = ANNUITY_YEARS,
): number | null {
  if (priceEur === null || priceEur <= 0 || years <= 0 || annualPct < 0) return null;
  const n = years * 12;
  const i = annualPct / 100 / 12;
  if (i === 0) return priceEur / n; // 0 % would divide by zero in the annuity formula
  return (priceEur * i) / (1 - Math.pow(1 + i, -n));
}
