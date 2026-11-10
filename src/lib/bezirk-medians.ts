/**
 * Rent €/m² medians per Wiener Bezirk — orientation, not a Mietspiegel.
 *
 * Source: viennalivingmap.com/themen/immobilienpreise-wien (Stand 11/2026):
 * ImmoScout offer medians 2024, indexed to Q1 2026 with the Statistik Austria
 * Häuserpreisindex (+5.5 %). Same basis as willhaben's Gesamtmiete €/m²
 * pills (asking rents incl. BK) — never present this as an official Mietspiegel.
 */
export const WIEN_RENT_MEDIAN_EUR_M2: Record<number, number> = {
  1: 29.01,
  2: 20.57,
  3: 21.63,
  4: 22.68,
  5: 20.04,
  6: 23.21,
  7: 23.74,
  8: 23.21,
  9: 22.68,
  10: 15.3,
  11: 14.24,
  12: 15.83,
  13: 23.74,
  14: 18.46,
  15: 16.35,
  16: 15.83,
  17: 16.88,
  18: 20.57,
  19: 22.15,
  20: 15.3,
  21: 15.61,
  22: 14.77,
  23: 17.41,
};

/** Vienna PLZ → Bezirk (1010→1 … 1230→23); null when outside that scheme. */
function bezirkFromPlz(plz: number): number | null {
  if (plz < 1010 || plz > 1230 || (plz - 1000) % 10 !== 0) return null;
  const d = (plz - 1000) / 10;
  return d >= 1 && d <= 23 ? d : null;
}

/** "…/wien/wien-1140-penzing/…" → 14 (slug carries the PLZ). */
export function bezirkFromHref(href: string | null | undefined): number | null {
  const m = href?.match(/wien-(\d{4})-/);
  return m ? bezirkFromPlz(Number(m[1])) : null;
}

/** "1140 Wien, 14. Bezirk, Penzing" → 14 (Bezirk text first, PLZ fallback). */
export function bezirkFromAddress(address: string | null | undefined): number | null {
  if (!address) return null;
  const byName = address.match(/(\d{1,2})\. Bezirk/);
  if (byName) {
    const d = Number(byName[1]);
    if (d >= 1 && d <= 23) return d;
  }
  const byPlz = address.match(/(\d{4})\s*Wien/);
  return byPlz ? bezirkFromPlz(Number(byPlz[1])) : null;
}

/** Median rent for a Bezirk; null for unknown districts (incl. outside Wien). */
export function rentMedianForBezirk(bezirk: number | null): number | null {
  return bezirk !== null ? WIEN_RENT_MEDIAN_EUR_M2[bezirk] ?? null : null;
}
