import browser from "webextension-polyfill";
import {
  cacheKey,
  getCached,
  setCached,
  TTL_BLOCKED_MS,
  TTL_OK_MS,
  type CacheStorage,
} from "../lib/cache";
import type { Listing } from "../lib/extract-willhaben";
import { rankCandidates } from "../lib/match";
import { detectBlock, parseAmazonSearch } from "../lib/parse-amazon";
import type { SearchRequest, SearchResponse } from "../lib/protocol";

const SEARCH_URL = "https://www.amazon.de/s?k=";
/** Min gap between amazon.de fetches; one request in flight at a time. */
const MIN_FETCH_INTERVAL_MS = 3000;
const CANDIDATES = 3;

const storage: CacheStorage = {
  get: async (key) => (await browser.storage.local.get(key))[key],
  set: async (key, value) => {
    await browser.storage.local.set({ [key]: value });
  },
};

// In-memory rate-limit state (per worker lifetime).
let lastFetchAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function withRateLimit<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastFetchAt + MIN_FETCH_INTERVAL_MS - Date.now();
    if (wait > 0) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, wait);
      await promise;
    }
    lastFetchAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function searchAmazon(request: SearchRequest): Promise<SearchResponse> {
  const url = `${SEARCH_URL}${encodeURIComponent(request.title)}&language=de_DE`;
  const res = await fetch(url, { credentials: "omit" });
  const html = await res.text();
  if (!res.ok || detectBlock(html)) return { status: "blocked" };

  const listing: Listing = {
    id: request.listingId,
    title: request.title,
    priceEur: request.priceEur,
    conditionText: "",
  };
  const candidates = rankCandidates(listing, parseAmazonSearch(html), CANDIDATES);
  const prices = candidates
    .map((c) => c.priceEur)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);
  const median =
    prices.length === 0
      ? null
      : prices.length % 2 === 1
        ? prices[(prices.length - 1) / 2]
        : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
  return { status: "ok", candidates, stats: { min: prices[0] ?? null, median } };
}

async function handleSearch(request: SearchRequest): Promise<SearchResponse> {
  const key = cacheKey(request.title.toLowerCase().replace(/\s+/g, " ").trim());
  try {
    const cached = await getCached<SearchResponse>(storage, key);
    if (cached) return cached;
    const response = await withRateLimit(() => searchAmazon(request));
    await setCached(
      storage,
      key,
      response,
      response.status === "blocked" ? TTL_BLOCKED_MS : TTL_OK_MS,
    );
    return response;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if ((message as SearchRequest)?.type !== "SEARCH_AMAZON") return undefined;
  return handleSearch(message as SearchRequest);
});
