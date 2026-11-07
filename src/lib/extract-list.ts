import { parseEurDe } from "./parse-eur";

export interface ListRow {
  id: string;
  title: string;
  priceEur: number | null;
  /** The card anchor — pill mounts next to its price element. */
  anchor: Element;
}

/**
 * Single source of truth for willhaben.at search-result selectors.
 * Live-verified against a saved fixture (tests/fixtures/willhaben-list.html);
 * when willhaben changes markup, update this object and the fixture together.
 */
export const SELECTORS_LIST = {
  /** One card per row: the whole card is an <a> to the detail page. */
  card: 'a[data-testid^="search-result-entry-header-"]',
  title: "h3",
  price: '[data-testid^="search-result-entry-price-"]',
} as const;

/** Listing id: card data-testid suffix first, href slug as fallback. */
export function listRowId(card: Element): string | null {
  const testid = card.getAttribute("data-testid") ?? "";
  const byTestid = testid.match(/^search-result-entry-header-(\d{6,})$/);
  if (byTestid) return byTestid[1];
  const href = card.getAttribute("href") ?? "";
  return href.match(/-(\d{6,})\/?$/)?.[1] ?? null;
}

/**
 * Extract the visible result rows from a willhaben.at list page.
 * Dedupes by listing id and skips cards without a title; rows without a
 * parsed price are kept — the badge can still show the new-price range.
 */
export function extractRows(root: ParentNode): ListRow[] {
  const seen = new Set<string>();
  const rows: ListRow[] = [];
  for (const card of root.querySelectorAll(SELECTORS_LIST.card)) {
    const id = listRowId(card);
    if (!id || seen.has(id)) continue;
    const title = (card.querySelector(SELECTORS_LIST.title)?.textContent ?? "").trim();
    if (!title) continue;
    const priceEl = card.querySelector(SELECTORS_LIST.price);
    const priceText = priceEl?.getAttribute("aria-label") ?? priceEl?.textContent ?? "";
    seen.add(id);
    rows.push({ id, title, priceEur: parseEurDe(priceText), anchor: card });
  }
  return rows;
}
