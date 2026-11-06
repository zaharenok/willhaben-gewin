import type { AmazonItem } from "./parse-amazon";
import type { GoogleItem } from "./parse-google";

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

/** Reply of the amazon-de content script (Plan B) to a PARSE_SEARCH message. */
export type TabParseResponse =
  | { type: "PARSE_RESULT"; status: "ok"; items: AmazonItem[] }
  | { type: "PARSE_RESULT"; status: "blocked" };

/** Ask the google-shopping relay content script to parse its page. */
export interface GoogleParseRequest {
  type: "PARSE_GOOGLE_SHOPPING";
}

/** Reply of the google-shopping relay content script to PARSE_GOOGLE_SHOPPING. */
export type GoogleParseResponse =
  | { type: "GOOGLE_RESULT"; status: "ok"; items: GoogleItem[] }
  | { type: "GOOGLE_RESULT"; status: "blocked" };
