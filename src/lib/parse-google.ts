import { parseEurDe } from "./parse-eur";

export interface GoogleItem {
  title: string;
  priceEur: number | null;
  shop: string;
  url: string;
}

/**
 * DOM-based by design (unlike parse-amazon.ts): this runs in the relay
 * content script on a real rendered Google page, where a DOM exists.
 * The MV3 service worker only relays messages — it never parses HTML.
 */
const PRICE_RE = /€\s?\d[\d.,]*/;
const SHOP_MAX_LEN = 40;
const FALLBACK_MIN_TITLE = 15;
const GOOGLE_ORIGIN = "https://www.google.com";

function oneLine(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(href: string): string {
  try {
    return new URL(href, GOOGLE_ORIGIN).toString();
  } catch {
    return "";
  }
}

/** Heading role first; longest non-price span when Google skips the role. */
function cardTitle(card: Element): string {
  const heading = oneLine(card.querySelector('[role="heading"], h3')?.textContent);
  if (heading) return heading;
  let best = "";
  for (const span of card.querySelectorAll("span")) {
    const text = oneLine(span.textContent);
    if (!text.includes("€") && text.length > best.length) best = text;
  }
  return best;
}

/** Merchant domain from the card when present; else the last short span. */
function cardShop(card: Element, title: string): string {
  const dtld = card.getAttribute("data-dtld");
  if (dtld) return dtld.trim();
  let shop = "Google Shopping";
  for (const span of card.querySelectorAll("span")) {
    const text = oneLine(span.textContent);
    if (!text || text === title || text.length > SHOP_MAX_LEN || text.includes("€")) continue;
    shop = text;
  }
  return shop;
}

/**
 * Parse a rendered Google Shopping results page into items. The live layout
 * (udm=28) renders one .pla-unit card per offer: data-offer-id, a data-dtld
 * merchant domain and a hidden /aclk? clickout link. Older layouts anchor
 * straight into /shopping/product/… — keep both selectors. When a variant
 * ships neither, fall back to priced anchors with a product-like title.
 * Dedupe by URL; skip cards without a parsable title. The live fixture
 * tests/fixtures/google-shopping.html pins the markup contract — update
 * parser and fixture together.
 */
export function parseGoogleShopping(doc: Document): GoogleItem[] {
  const seen = new Set<string>();
  const items: GoogleItem[] = [];

  const primary = [...doc.querySelectorAll<Element>('.pla-unit, a[href*="/shopping/product/"]')];
  const cards =
    primary.length > 0
      ? primary
      : [...doc.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((a) =>
          PRICE_RE.test(a.textContent ?? ""),
        );
  const minTitleLen = primary.length > 0 ? 1 : FALLBACK_MIN_TITLE;

  for (const card of cards) {
    const href =
      card.getAttribute("href") ??
      card.querySelector('a[href*="/aclk?"]')?.getAttribute("href") ??
      card.querySelector("a[href]")?.getAttribute("href") ??
      "";
    const url = absoluteUrl(href);
    if (!url || seen.has(url)) continue;
    const title = cardTitle(card);
    if (title.length < minTitleLen) continue;
    const priceText = oneLine(card.textContent).match(PRICE_RE)?.[0];
    const priceEur = priceText ? parseEurDe(priceText) : null;
    items.push({ title, priceEur, shop: cardShop(card, title), url });
    seen.add(url);
  }
  return items;
}

/**
 * True when Google served a /sorry/ block or a consent wall instead of
 * results. The /sorry/ redirect leaves the target URL in <title>.
 */
export function isGoogleBlockOrConsent(doc: Document): boolean {
  if (doc.title.startsWith("http")) return true;
  const body = doc.body?.textContent ?? "";
  if (body.includes("Vor dem Fortfahren") || body.includes("Before you continue")) return true;
  return doc.querySelector('script[src*="recaptcha"]') !== null;
}
