import type { AmazonItem } from "./parse-amazon";
import type { Listing } from "./extract-willhaben";

const STOPWORDS = new Set([
  // DE
  "der", "die", "das", "und", "mit", "für", "fuer", "neu", "ist", "auch", "nur",
  // EN
  "new", "the", "and", "for", "with", "of", "in",
]);

/** Lowercase, strip punctuation, drop stopwords. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Words that describe the offer, not the product — poison for search. */
const CONDITION_WORDS: Record<string, true> = {
  neu: true, versiegelt: true, gebraucht: true, neuwertig: true, ovp: true,
  refurbished: true, "generalüberholt": true, defekt: true, spenden: true,
  versand: true, abholung: true, ticket: true, src: true,
};

/**
 * Focused amazon.de search query for a willhaben title: condition words out,
 * first 8 tokens kept. Amazon relevance collapses on long spec-laden titles
 * ("Apple Mac Studio M4 Max 128 GB RAM 2 TB SSD" finds MacBooks and SSD
 * upgrades instead of the Mac Studio itself) — brand + model up front works.
 */
export function searchQueryFor(title: string): string {
  return tokenize(title)
    .filter((token) => !CONDITION_WORDS[token])
    .slice(0, 8)
    .join(" ");
}

function weight(token: string): number {
  // Numbers (sizes, model numbers) count double.
  return /\d/.test(token) ? 2 : 1;
}

/**
 * Product-line words: sharing one of these means the same family. When both
 * titles carry line words but none shared ("mac studio" vs "macbook pro"),
 * they are different products — veto regardless of chip/RAM overlap.
 */
const LINE_WORDS: Record<string, true> = {
  macbook: true, studio: true, mini: true, imac: true,
};

/** Accessory markers: a €12 sleeve is not a price reference for a laptop. */
const ACCESSORY_WORDS: Record<string, true> = {
  hülle: true, case: true, tasche: true, sleeve: true,
  folie: true, staender: true, "ständer": true, zubehör: true, ladegerät: true,
  ladekabel: true, kabel: true, halterung: true, kompatibel: true, etui: true,
  staubschutz: true,
};

/** Brands: an Apple listing never has an HP candidate as its price reference. */
const BRAND_WORDS: Record<string, true> = {
  apple: true, samsung: true, hp: true, dell: true, lenovo: true, asus: true,
  acer: true, lg: true, huawei: true, xiaomi: true, msi: true, honor: true,
  sony: true, panasonic: true, canon: true, nikon: true, bosch: true, makita: true,
  jbl: true, anker: true, logitech: true, nintendo: true,
};
function capacitiesGb(text: string): string[] {
  const tokens = tokenize(text);
  const caps: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (/^\d+$/.test(tokens[i]) && tokens[i + 1] === "gb") caps.push(tokens[i]);
    const merged = tokens[i].match(/^(\d+)gb$/);
    if (merged) caps.push(merged[1]);
  }
  return caps;
}
/**
 * Symmetric relevance: the better of "query covered by candidate" and
 * "candidate covered by query". Amazon titles are short ("Apple Mac Studio
 * mit M5 Max Chip"), willhaben titles spec-laden — one-way overlap punishes
 * the true product when the listing lists specs Amazon omits.
*/
export function relevance(a: string, b: string): number {
  // Brand veto: Apple vs HP is never the same product, whatever specs align.
  const aBrands = tokenize(a).filter((t) => BRAND_WORDS[t]);
  const bBrands = tokenize(b).filter((t) => BRAND_WORDS[t]);
  if (aBrands.length > 0 && bBrands.length > 0 && !aBrands.some((x) => bBrands.includes(x))) {
    return 0;
  }
  // Line veto: "mac studio" vs "macbook pro" are different products even
  // with the same chip and RAM — a shared line word is required.
  const aLines = tokenize(a).filter((t) => LINE_WORDS[t]);
  const bLines = tokenize(b).filter((t) => LINE_WORDS[t]);
  if (aLines.length > 0 && bLines.length > 0 && !aLines.some((l) => bLines.includes(l))) {
    return 0;
  }
  // Accessory veto: a sleeve/case/stand that MERELY fits the product is not
  // the product — unless the listing itself sells that accessory.
  const aAcc = tokenize(a).some((t) => ACCESSORY_WORDS[t]);
  const bAcc = tokenize(b).some((t) => ACCESSORY_WORDS[t]);
  if (bAcc && !aAcc) return 0;
  // Capacity veto: a 128 GB machine is NOT comparable to a 36 GB one,
  // whatever the generation — RAM size is part of the product identity.
  const aCaps = capacitiesGb(a);
  const bCaps = capacitiesGb(b);
  if ((aCaps.length > 0 || bCaps.length > 0) && !aCaps.some((c) => bCaps.includes(c))) {
    return 0;
  }
  return Math.max(scoreMatch(a, b), scoreMatch(b, a));
}
/**
 * Relevance of `candidate` for `query`, 0–1:
 * weighted token overlap over the query's total weight.
 */
export function scoreMatch(query: string, candidate: string): number {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return 0;
  const cTokens = new Set(tokenize(candidate));
  if (cTokens.size === 0) return 0;

  let hits = 0;
  let total = 0;
  for (const token of qTokens) {
    const w = weight(token);
    total += w;
    if (cTokens.has(token)) hits += w;
  }
  return total === 0 ? 0 : hits / total;
}

/** Top-n Amazon candidates for a listing, best score first.
 * Candidates below `minScore` (weighted token overlap) are dropped —
 * without a threshold a "MacBook Pro" sneaks in for a "Mac mini" listing. */
export function rankCandidates(listing: Listing, items: AmazonItem[], n = 3, minScore = 0): AmazonItem[] {
  return items
    .map((item) => ({ item, score: relevance(listing.title, item.title) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.item);
}
