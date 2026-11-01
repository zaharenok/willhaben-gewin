import { parseEurDe } from "./parse-eur";

export interface Listing {
  id: string;
  title: string;
  priceEur: number | null;
  conditionText: string;
}

/**
 * Single source of truth for willhaben.at detail-page selectors.
 * Live-verified against a saved fixture (tests/fixtures/willhaben-ad.html);
 * when willhaben changes markup, update this object and the fixture together.
 */
export const SELECTORS = {
  title: 'h1[data-testid="ad-detail-header"]',
  price: '[data-testid="contact-box-price-box-price-value-0"]',
  priceFallback: '[data-testid="sticky-header-price"]',
  attributeItem: '[data-testid="attribute-item"]',
  attributeTitle: '[data-testid="attribute-title"]',
  attributeValue: '[data-testid="attribute-value"]',
  adCode: '[data-testid="ad-detail-ad-wh-code-top"]',
  conditionLabel: "Zustand",
} as const;

/** Extract the listing from a willhaben.at detail page; null when not a detail page. */
export function extractListing(doc: Document): Listing | null {
  const titleEl = doc.querySelector(SELECTORS.title);
  if (!titleEl) return null;
  const title = (titleEl.textContent ?? "").trim();
  if (!title) return null;

  const priceEl =
    doc.querySelector(SELECTORS.price) ?? doc.querySelector(SELECTORS.priceFallback);
  const priceEur = priceEl ? parseEurDe(priceEl.textContent ?? "") : null;

  let conditionText = "";
  for (const item of doc.querySelectorAll(SELECTORS.attributeItem)) {
    const label = item.querySelector(SELECTORS.attributeTitle)?.textContent?.trim();
    if (label === SELECTORS.conditionLabel) {
      conditionText = item.querySelector(SELECTORS.attributeValue)?.textContent?.trim() ?? "";
      break;
    }
  }

  const id = extractId(doc);
  if (!id) return null;
  return { id, title, priceEur, conditionText };
}

/** Listing id: "willhaben-Code: 123…" element first, URL slug as fallback. */
function extractId(doc: Document): string | null {
  const codeEl = doc.querySelector(SELECTORS.adCode);
  const code = codeEl?.textContent?.match(/\d{6,}/)?.[0];
  if (code) return code;
  const href = doc.location?.href ?? "";
  return href.match(/-(\d{6,})\/?(?:[?#]|$)/)?.[1] ?? null;
}
