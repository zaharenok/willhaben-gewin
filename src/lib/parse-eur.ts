/**
 * de-DE currency parsing: "€ 1.234,56" / "281,34 €" → 1234.56 / 281.34.
 * Thousands dots removed, comma becomes decimal point.
 * Returns null when no numeric value is present.
 */
export function parseEurDe(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
