import type { AmazonItem } from "./parse-amazon";

/**
 * Parser for Apple's Refurbished Store category pages
 * (e.g. https://www.apple.com/at/shop/refurbished/mac). Every product is a
 * schema.org Product JSON-LD block — no DOM needed, works in the MV3 worker.
 */
export function parseAppleRefurb(html: string): AmazonItem[] {
  const items: AmazonItem[] = [];
  const marker = '<script type="application/ld+json">';
  let at = html.indexOf(marker);
  while (at !== -1) {
    const start = at + marker.length;
    const end = html.indexOf("</script>", start);
    if (end === -1) break;
    try {
      const data = JSON.parse(html.slice(start, end)) as {
        "@type"?: string;
        name?: string;
        url?: string;
        offers?: { price?: number }[];
      };
      if (data["@type"] === "Product" && data.name && data.offers?.[0]?.price != null) {
        // "Refurbished MacBook Pro …" → "MacBook Pro …" so the matcher's
        // line words and tokens line up with willhaben titles.
        const title = data.name.replace(/^Refurbished\s+/i, "").trim();
        const asin = data.url?.match(/\/product\/([^/]+)\//)?.[1] ?? "";
        if (title && asin) {
          items.push({ asin: `apple:${asin}`, title, priceEur: data.offers[0]?.price ?? null, source: "apple", url: data.url });
        }
      }
    } catch {
      // malformed block — skip
    }
    at = html.indexOf(marker, end);
  }
  return items;
}
