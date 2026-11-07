import { computeSavings, formatEur } from "./savings";
import { t } from "./i18n";

export type RowBadgeKind = "win" | "loss" | "unknown";

export interface RowBadge {
  text: string;
  kind: RowBadgeKind;
  tooltip: string;
}

export interface RowStats {
  min: number | null;
  median: number | null;
}

/**
 * Win/loss badge for a list row. Reference is the median new-price candidate
 * — the same unconfirmed "≈" preview the detail badge shows. computeSavings
 * yields diffEur = ref − listing: positive = listing undercuts the reference
 * (win, shown as a saving "−€…"), negative = listing overpays ("+€…", loss).
 * Returns null when there is nothing meaningful to show.
 */
export function rowBadge(stats: RowStats, listingPriceEur: number | null): RowBadge | null {
  const range = priceRange(stats);
  if (listingPriceEur === null) {
    if (range === null) return null;
    return {
      text: `≈ ${formatEur(stats.median ?? stats.min!)}`,
      kind: "unknown",
      tooltip: `${t("listTooltip")}: ${range}`,
    };
  }
  const ref = stats.median ?? stats.min;
  if (ref === null) return null;
  const { diffEur, pct } = computeSavings(listingPriceEur, ref);
  const win = diffEur > 0;
  const sign = win ? "−" : "+";
  return {
    text: `${sign}${formatEur(Math.abs(diffEur))} (${sign}${Math.abs(pct)}%)`,
    kind: win ? "win" : "loss",
    tooltip: `${t("listTooltip")}: ${range ?? formatEur(ref)}`,
  };
}

/** "€ 380,00 – € 429,65" over the candidates' min–median; null without prices. */
function priceRange(stats: RowStats): string | null {
  const { min, median } = stats;
  if (min === null && median === null) return null;
  if (median === null || median === min) return formatEur(min!);
  return `${formatEur(min!)} – ${formatEur(median)}`;
}
