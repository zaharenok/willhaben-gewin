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

function weight(token: string): number {
  // Numbers (sizes, model numbers) count double.
  return /\d/.test(token) ? 2 : 1;
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
    .map((item) => ({ item, score: scoreMatch(listing.title, item.title) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.item);
}
