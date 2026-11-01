import type { AmazonItem } from "./parse-amazon";

export interface SearchRequest {
  type: "SEARCH_AMAZON";
  listingId: string;
  title: string;
  priceEur: number | null;
}

export interface SearchStats {
  /** Cheapest candidate price; null when no candidate has a parsed price. */
  min: number | null;
  /** Median of candidate prices; drives the unconfirmed preview badge. */
  median: number | null;
}

export type SearchResponse =
  | { status: "ok"; candidates: AmazonItem[]; stats: SearchStats }
  | { status: "blocked" }
  | { status: "error"; message: string };
