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
/** Chip-generation tokens: "m1"…"m5", "m4", "m4x" style model codes. */
const MODEL_TOKEN = /^m\d+$/;

/**
 * Symmetric relevance: the better of "query covered by candidate" and
 * "candidate covered by query". Amazon titles are short ("Apple Mac Studio
 * mit M5 Max Chip"), willhaben titles spec-laden — one-way overlap punishes
 * the true product when the listing lists specs Amazon omits.
 *
 * Generation veto: a Mac Studio M4 Max is NOT a Mac Studio M5 Max. When both
 * sides carry chip tokens (m1…m5) and none match, relevance is 0.
 */
export function relevance(a: string, b: string): number {
  const aModels = tokenize(a).filter((t) => MODEL_TOKEN.test(t));
  const bModels = tokenize(b).filter((t) => MODEL_TOKEN.test(t));
  if (aModels.length > 0 && bModels.length > 0 && !aModels.some((t) => bModels.includes(t))) {
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
