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
import { rankCandidates, searchQueryFor } from "../lib/match";
import { parseAppleRefurb } from "../lib/parse-apple";
import { detectBlock, parseAmazonSearch, type AmazonItem } from "../lib/parse-amazon";
import type { SearchRequest, SearchResponse, TabParseResponse } from "../lib/protocol";

const SEARCH_URL = "https://www.amazon.de/s?k=";
/** Min gap between amazon.de fetches; one request in flight at a time. */
const MIN_FETCH_INTERVAL_MS = 3000;
const CANDIDATES = 3;
/** Weighted token overlap a candidate needs to count as the same product. */
const MIN_MATCH_SCORE = 0.5;
const APPLE_REFURB_URL = "https://www.apple.com/at/shop/refurbished/";
/** Listing titles that make sense to look up in Apple's Refurbished Store. */
const APPLE_HINT = /(apple|macbook|imac|mac\s?mini|mac\s?studio|mac\s?pro|iphone|ipad)/i;
/** Refurb category for a listing title. */
function appleRefurbPath(title: string): string | null {
  if (!APPLE_HINT.test(title)) return null;
  if (/iphone/i.test(title)) return "iphone";
  if (/ipad/i.test(title)) return "ipad";
  if (APPLE_HINT.test(title)) return "mac";
  return null;
}

const storage: CacheStorage = {
  get: async (key) => (await browser.storage.local.get(key))[key],
  set: async (key, value) => {
    await browser.storage.local.set({ [key]: value });
  },
};

// In-memory rate-limit state (per worker lifetime).
let lastFetchAt = 0;
let queue: Promise<unknown> = Promise.resolve();

console.log("[whg:bg] service worker up, version", browser.runtime.getManifest().version);

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function withRateLimit<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastFetchAt + MIN_FETCH_INTERVAL_MS - Date.now();
    if (wait > 0) await delay(wait);
    lastFetchAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Rank parsed items and compute min/median stats for the response. */
function buildResponse(request: SearchRequest, items: AmazonItem[]): SearchResponse {
  const listing: Listing = {
    id: request.listingId,
    title: request.title,
    priceEur: request.priceEur,
    conditionText: "",
  };
  const candidates = rankCandidates(listing, items, CANDIDATES, MIN_MATCH_SCORE);
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

async function searchAmazon(request: SearchRequest): Promise<SearchResponse> {
  const url = `${SEARCH_URL}${encodeURIComponent(searchQueryFor(request.title))}&language=de_DE`;
  const res = await fetch(url, { credentials: "omit" });
  const html = await res.text();
  const blocked = !res.ok || detectBlock(html);
  console.log("[whg:bg] fetch", { status: res.status, bytes: html.length, blocked });
  if (blocked) return { status: "blocked" };

  const items = parseAmazonSearch(html);
  console.log("[whg:bg] parsed", { items: items.length });
  return buildResponse(request, items);
}

// Plan B: poll the relay content script in a background tab until it answers.
// The window covers slow loads; document_idle injection lags document load.
const TAB_READY_DEADLINE_MS = 25_000;
const TAB_READY_DELAY_MS = 500;

async function searchViaHiddenTab(request: SearchRequest): Promise<SearchResponse> {
  const url = `${SEARCH_URL}${encodeURIComponent(searchQueryFor(request.title))}&language=de_DE`;
  const tab = await browser.tabs.create({ url, active: false });
  const tabId = tab.id;
  console.log("[whg:bg] hidden tab opened", { tabId, url });
  if (tabId == null) return { status: "error", message: "tabs.create returned no id" };

  try {
    const startedAt = Date.now();
    while (Date.now() - startedAt < TAB_READY_DEADLINE_MS) {
      // A blocked session redirects off /s — the relay never runs there.
      const live = await browser.tabs.get(tabId).catch(() => null);
      if (!live) return { status: "blocked" };
      if (live.url && /^https?:/.test(live.url) && !live.url.includes("amazon.de/s")) {
        console.warn("[whg:bg] hidden tab left the search page", live.url);
        return { status: "blocked" };
      }
      try {
        // Trusted: produced by our own src/content/amazon.ts (no external senders).
        const parsed = (await browser.tabs.sendMessage(tabId, {
          type: "PARSE_SEARCH",
        })) as TabParseResponse | undefined;
        if (parsed?.status === "ok") {
          console.log("[whg:bg] hidden tab parsed", parsed.items.length, "items");
          return buildResponse(request, parsed.items);
        }
        if (parsed?.status === "blocked") {
          console.warn("[whg:bg] hidden tab reports a block page");
          return { status: "blocked" };
        }
      } catch (error) {
        // Content script not injected yet — page still loading.
        console.log(
          "[whg:bg] hidden tab send failed",
          Date.now() - startedAt,
          String(error).slice(0, 90),
        );
      }
      await delay(TAB_READY_DELAY_MS);
    }
    console.warn("[whg:bg] hidden tab never became ready");
    return { status: "blocked" };
  } finally {
    await browser.tabs.remove(tabId).catch(() => undefined);
}
}

async function searchAppleRefurb(request: SearchRequest, path: string): Promise<SearchResponse> {
  const res = await fetch(`${APPLE_REFURB_URL}${path}`, { credentials: "omit" });
  const html = await res.text();
  console.log("[whg:bg] apple refurb fetch", { status: res.status, bytes: html.length });
  if (!res.ok) return { status: "error", message: `apple refurb HTTP ${res.status}` };
  const items: AmazonItem[] = parseAppleRefurb(html);
  console.log("[whg:bg] apple refurb parsed", items.length, "items");
  return buildResponse(request, items);
}

async function handleSearch(request: SearchRequest): Promise<SearchResponse> {
  const key = cacheKey(request.title.toLowerCase().replace(/\s+/g, " ").trim());
  try {
    const cached = await getCached<SearchResponse>(storage, key);
    if (cached) {
      console.log("[whg:bg] cache hit", key);
      return cached;
    }
    console.log("[whg:bg] cache miss, queueing fetch", key);

    let direct: SearchResponse | null = null;
    try {
      direct = await withRateLimit(() => searchAmazon(request));
    } catch (error) {
      console.error("[whg:bg] direct fetch threw", error);
    }
    // A 200 can still be a bot-lite page with results but stripped prices;
    // only a priced result is a real success (cacheable).
    if (direct?.status === "ok" && direct.stats.min !== null) {
      await setCached(storage, key, direct, TTL_OK_MS);
      return direct;
    }
    if (direct?.status === "ok") {
      console.warn("[whg:bg] direct path returned no priced items, trying hidden-tab fallback");
    }

    console.log("[whg:bg] direct path failed, trying hidden-tab fallback", direct?.status ?? "fetch error");
    let viaTab: SearchResponse | null = null;
    try {
      viaTab = await withRateLimit(() => searchViaHiddenTab(request));
    } catch (error) {
      console.error("[whg:bg] hidden tab threw", error);
    }
    const amazonOk = direct?.status === "ok" ? direct : viaTab?.status === "ok" ? viaTab : null;
    if (amazonOk && amazonOk.candidates.length > 0) {
      if (amazonOk.stats.min !== null) await setCached(storage, key, amazonOk, TTL_OK_MS);
      return amazonOk;
    }

    // Apple Refurbished Store: past generations live there, not on Amazon.
    const applePath = appleRefurbPath(request.title);
    if (applePath) {
      console.log("[whg:bg] amazon found nothing relevant, trying apple refurb", applePath);
      try {
        const apple = await withRateLimit(() => searchAppleRefurb(request, applePath));
        if (apple.status === "ok" && apple.candidates.length > 0) {
          await setCached(storage, key, apple, TTL_OK_MS);
          return apple;
        }
        console.log("[whg:bg] apple refurb yielded no relevant items");
      } catch (error) {
        console.error("[whg:bg] apple refurb threw", error);
      }
    }

    if (amazonOk) return amazonOk; // honest "no match" with empty candidates

    // Only a definitive block (detected on the direct path) is worth caching.
    if (direct?.status === "blocked") {
      await setCached(storage, key, { status: "blocked" } satisfies SearchResponse, TTL_BLOCKED_MS);
      return { status: "blocked" };
    }
    if (viaTab?.status === "blocked") return { status: "blocked" };
    return { status: "error", message: "both direct fetch and hidden-tab parse failed" };
  } catch (error) {
    console.error("[whg:bg] search failed", error);
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message !== "object" || message === null || !("type" in message)) return undefined;
  if (message.type !== "SEARCH_AMAZON") return undefined;
  // Our own content script is the only allowed sender (no externally_connectable).
  if (!("listingId" in message) || typeof message.listingId !== "string") return undefined;
  if (!("title" in message) || typeof message.title !== "string") return undefined;
  const request: SearchRequest = {
    type: "SEARCH_AMAZON",
    listingId: message.listingId,
    title: message.title,
    priceEur: "priceEur" in message && typeof message.priceEur === "number" ? message.priceEur : null,
  };
  console.log("[whg:bg] SEARCH_AMAZON received", { title: request.title, priceEur: request.priceEur });
  return handleSearch(request);
});
