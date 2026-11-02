import { parseEurDe } from "./parse-eur";

export interface AmazonItem {
  asin: string;
  title: string;
  priceEur: number | null;
  /** Where the item came from — shown as a tag in the confirm panel. */
  source?: "amazon" | "apple";
}

/**
 * Pure string parsing — intentionally NOT DOMParser: MV3 service workers have
 * no DOM APIs, and the background worker is the only caller. The live-HTML
 * fixture in tests/fixtures/amazon-search.html pins the markup contract;
 * update both together when amazon.de changes.
 */
const ROW_MARKER = 'data-component-type="s-search-result"';
const PRICE_OFFSCREEN = 'a-offscreen">';
/**
 * Rows run 22–37 KB (csa JSON blobs), titles land at ~4–9 KB, prices at
 * ~8–15 KB. Only the final row has no following marker to bound it — scan a
 * window big enough for a whole row, so footer content can never leak in.
 */
const LAST_ROW_LIMIT = 20_000;
/** Bound: a row's own `.a-offscreen` sits immediately inside its `.a-price`. */
const PRICE_SEARCH_WINDOW = 400;

/** Markers of Amazon bot-block / captcha / sorry pages. */
const BLOCK_MARKERS = [
  "api-services-support@amazon.com",
  "Enter the characters you see below",
  "Tut uns Leid!",
];

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&nbsp;": "\u00A0",
};

function decodeEntities(text: string): string {
  const numericDecoded = text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  return numericDecoded.replace(/&(?:amp|lt|gt|quot|nbsp);/g, (m) => ENTITIES[m]);
}

function textOf(htmlFragment: string): string {
  return decodeEntities(htmlFragment.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

/** Parse amazon.de search-result HTML into items. Price may be null (no offer). */
export function parseAmazonSearch(html: string): AmazonItem[] {
  const items: AmazonItem[] = [];
  let markerAt = html.indexOf(ROW_MARKER);

  while (markerAt !== -1) {
    const tagEnd = html.indexOf(">", markerAt);
    const nextRowAt = html.indexOf(ROW_MARKER, markerAt + ROW_MARKER.length);
    const contentStart = tagEnd === -1 ? markerAt + ROW_MARKER.length : tagEnd + 1;
    const isLastRow = nextRowAt === -1;
    const contentEnd = isLastRow
      ? Math.min(html.length, contentStart + LAST_ROW_LIMIT)
      : nextRowAt;
    const segment = html.slice(contentStart, contentEnd);

    // Row attributes (data-asin) precede the marker inside the opening tag.
    const tagStart = html.indexOf("<", html.lastIndexOf(">", markerAt));
    const openTag = tagEnd === -1 || tagStart === -1 ? "" : html.slice(tagStart, tagEnd + 1);
    const asin = openTag.match(/\sdata-asin="([^"]+)"/)?.[1] ?? "";

    const title = textOf(segment.match(/<h2(?=[\s>])[\s\S]*?<\/h2>/)?.[0] ?? "");

    let priceEur: number | null = null;
    const priceAt = segment.indexOf('class="a-price');
    if (priceAt !== -1) {
      const offAt = segment.indexOf(PRICE_OFFSCREEN, priceAt);
      if (offAt !== -1 && offAt - priceAt < PRICE_SEARCH_WINDOW) {
        const textStart = offAt + PRICE_OFFSCREEN.length;
        const textEnd = segment.indexOf("<", textStart);
        priceEur = parseEurDe(segment.slice(textStart, textEnd === -1 ? undefined : textEnd));
      }
    }

    if (asin && title) items.push({ asin, title, priceEur });
    markerAt = nextRowAt;
  }
  return items;
}

/** True when the response is a block/captcha/sorry page rather than results. */
export function detectBlock(html: string): boolean {
  return BLOCK_MARKERS.some((marker) => html.includes(marker));
}
