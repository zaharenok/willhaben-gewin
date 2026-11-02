/**
 * All outbound amazon.de URLs in ONE place, with the optional Associates tag.
 *
 * NOTE: Amazon Associates program policies forbid affiliate links in browser
 * extensions ("You will not use any Program Content or Special Link… on or in
 * connection with any client-side software application"). Keep AMAZON_TAG
 * empty while this ships as an extension.
 */
export const AMAZON_TAG = "";

/** Search URL used for fetching AND for the user-facing "open search" links. */
export function amazonSearchUrl(query: string): string {
  const tag = AMAZON_TAG ? `&tag=${AMAZON_TAG}` : "";
  return `https://www.amazon.de/s?k=${encodeURIComponent(query)}${tag}`;
}

/** Product page URL for a candidate row. */
export function amazonProductUrl(asin: string): string {
  const tag = AMAZON_TAG ? `?tag=${AMAZON_TAG}` : "";
  return `https://www.amazon.de/dp/${encodeURIComponent(asin)}${tag}`;
}
