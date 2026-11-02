/**
 * All outbound amazon.de URLs in ONE place, with the Associates tag.
 * Change the tag here and every badge/panel/fallback link follows.
 */
export const AMAZON_TAG = "how2austria-21";

/** Search URL used for fetching AND for the user-facing "open search" links. */
export function amazonSearchUrl(query: string): string {
  return `https://www.amazon.de/s?k=${encodeURIComponent(query)}&tag=${AMAZON_TAG}`;
}

/** Product page URL for a candidate row (affiliated deep link). */
export function amazonProductUrl(asin: string): string {
  return `https://www.amazon.de/dp/${encodeURIComponent(asin)}?tag=${AMAZON_TAG}`;
}
