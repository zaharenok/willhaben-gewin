export interface Savings {
  diffEur: number;
  pct: number;
}

/**
 * How much more the used willhaben price is than the Amazon new price
 * (negative = used is cheaper). Rounding: cents to 2dp, percent integer.
 */
export function computeSavings(willhabenEur: number, amazonEur: number): Savings {
  const diffEur = Math.round((amazonEur - willhabenEur) * 100) / 100;
  const pct = willhabenEur === 0 ? 0 : Math.round((diffEur / willhabenEur) * 100);
  return { diffEur, pct };
}

const DE_AT = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export function formatEur(n: number): string {
  return DE_AT.format(n);
}
