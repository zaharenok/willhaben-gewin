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
import type { GoogleItem } from "../lib/parse-google";
import type { SearchRequest, SearchResponse } from "../lib/protocol";

const SEARCH_URL = "https://www.amazon.de/s?k=";
/** Google Shopping search — offers only render in a real tab (see relay). */
const GOOGLE_SHOPPING_URL = "https://www.google.com/search?udm=28";
/** Min gap between fetches/tab openings; one request in flight at a time. */
const MIN_FETCH_INTERVAL_MS = 3000;
const CANDIDATES = 3;
/** Panel cap for google candidates on top of amazon/apple ones. */
const GOOGLE_CANDIDATES = 2;
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

/** One source's outcome before ranking; ranking happens once in handleSearch. */
type RawResult =
  | { status: "ok"; items: AmazonItem[] }
  | { status: "blocked" }
  | { status: "error"; message: string };

/** djb2 (same loop as cacheKey) over a URL → stable synthetic id "g:<hash>". */
function hash36(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function listingOf(request: SearchRequest): Listing {
  return {
    id: request.listingId,
    title: request.title,
    priceEur: request.priceEur,
    conditionText: "",
  };
}

/** Rank a source's raw items down to its panel cap; matcher vetoes apply. */
function rankSource(request: SearchRequest, items: AmazonItem[], n: number): AmazonItem[] {
  return rankCandidates(listingOf(request), items, n, MIN_MATCH_SCORE);
}

function hasPrice(candidates: AmazonItem[]): boolean {
  return candidates.some((c) => c.priceEur !== null);
}

/** Final response: ranked base + ranked google; stats over the capped merge. */
function buildResponse(request: SearchRequest, base: AmazonItem[], googleItems: AmazonItem[]): SearchResponse {
  const candidates = [...base, ...rankSource(request, googleItems, GOOGLE_CANDIDATES)];
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

async function searchAmazon(request: SearchRequest): Promise<RawResult> {
  const url = `${SEARCH_URL}${encodeURIComponent(searchQueryFor(request.title))}&language=de_DE`;
  const res = await fetch(url, { credentials: "omit" });
  const html = await res.text();
  const blocked = !res.ok || detectBlock(html);
  console.log("[whg:bg] fetch", { status: res.status, bytes: html.length, blocked });
  if (blocked) return { status: "blocked" };

  const items = parseAmazonSearch(html);
  console.log("[whg:bg] parsed", { items: items.length });
  return { status: "ok", items };
}

// Relay plan B: poll the relay content script in a background tab until it
// answers. The window covers slow loads; document_idle injection lags
// document load.
const TAB_READY_DEADLINE_MS = 25_000;
const TAB_READY_DELAY_MS = 500;
/** Google Shopping renders offers after load — keep polling empty parses this long. */
const GOOGLE_HYDRATION_WAIT_MS = 10_000;

type RelayOutcome<T> =
  | { status: "ok"; items: T[] }
  | { status: "blocked" }
  | { status: "timeout" }
  | { status: "error"; message: string };

/**
 * Open a hidden tab on `url` and poll its relay content script until it
 * answers `message`. A live tab on an off-target https URL counts as a
 * redirect away from the search page (block/consent) → blocked. The tab is
 * always closed; keep everything inside the 3 s rate-limit queue (one tab
 * at a time).
 */
async function openRelayTab<T>(
  url: string,
  message: { type: string },
  keep: (liveUrl: string) => boolean,
  emptyWaitMs = 0,
): Promise<RelayOutcome<T>> {
  const tab = await browser.tabs.create({ url, active: false });
  const tabId = tab.id;
  console.log("[whg:bg] hidden tab opened", { tabId, url });
  if (tabId == null) return { status: "error", message: "tabs.create returned no id" };

  try {
    const startedAt = Date.now();
    while (Date.now() - startedAt < TAB_READY_DEADLINE_MS) {
      // A redirected session is off the search page — the relay never runs there.
      const live = await browser.tabs.get(tabId).catch(() => null);
      if (!live) return { status: "blocked" };
      if (live.url && /^https?:/.test(live.url) && !keep(live.url)) {
        console.warn("[whg:bg] hidden tab left the search page", live.url);
        return { status: "blocked" };
      }
      try {
        // Trusted: produced by our own relay content scripts (no external senders).
        const parsed = (await browser.tabs.sendMessage(tabId, message)) as
          | { status?: string; items?: T[] }
          | undefined;
        if (parsed?.status === "ok") {
          const items = parsed.items ?? [];
          // Pages that render cards after load (Google Shopping) report an
          // empty parse on the first poll — keep polling within emptyWaitMs.
          const stillHydrating = items.length === 0 && Date.now() - startedAt < emptyWaitMs;
          if (!stillHydrating) {
            console.log("[whg:bg] hidden tab parsed", items.length, "items");
            return { status: "ok", items };
          }
          console.log("[whg:bg] hidden tab parsed 0 items — waiting for hydration");
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
    return { status: "timeout" };
  } finally {
    await browser.tabs.remove(tabId).catch(() => undefined);
  }
}

async function searchViaHiddenTab(request: SearchRequest): Promise<RawResult> {
  const url = `${SEARCH_URL}${encodeURIComponent(searchQueryFor(request.title))}&language=de_DE`;
  const outcome = await openRelayTab<AmazonItem>(
    url,
    { type: "PARSE_SEARCH" },
    (liveUrl) => liveUrl.includes("amazon.de/s"),
  );
  if (outcome.status === "ok") return { status: "ok", items: outcome.items };
  if (outcome.status === "error") return outcome;
  return { status: "blocked" }; // blocked or timeout — both mean "no amazon data"
}

/**
 * Google Shopping via the hidden-tab relay. Direct fetches only get a JS
 * shell and headless sessions get /sorry/ — only a real tab in the user's
 * browser renders offers. Additive: any failure yields [] and the badge
 * falls back to amazon/apple candidates.
 */
async function searchGoogleShopping(request: SearchRequest): Promise<AmazonItem[]> {
  try {
    // GOOGLE_SHOPPING_URL already carries "?udm=28" — append with "&", not "?".
    const url = `${GOOGLE_SHOPPING_URL}&q=${encodeURIComponent(searchQueryFor(request.title))}&hl=de&gl=at`;
    const outcome = await openRelayTab<GoogleItem>(
      url,
      { type: "PARSE_GOOGLE_SHOPPING" },
      (liveUrl) => liveUrl.includes("google.com/search"),
      GOOGLE_HYDRATION_WAIT_MS,
    );
    if (outcome.status !== "ok") {
      console.warn("[whg:bg] google shopping unavailable", outcome.status);
      return [];
    }
    const items = outcome.items.map(
      (g): AmazonItem => ({
        asin: `g:${hash36(g.url)}`,
        title: g.title,
        priceEur: g.priceEur,
        source: "google",
        shop: g.shop,
        url: g.url,
      }),
    );
    console.log("[whg:bg] google shopping mapped", items.length, "candidates");
    return items;
  } catch (error) {
    console.error("[whg:bg] google shopping threw", error);
    return [];
  }
}

async function searchAppleRefurb(path: string): Promise<RawResult> {
  const res = await fetch(`${APPLE_REFURB_URL}${path}`, { credentials: "omit" });
  const html = await res.text();
  console.log("[whg:bg] apple refurb fetch", { status: res.status, bytes: html.length });
  if (!res.ok) return { status: "error", message: `apple refurb HTTP ${res.status}` };
  const items: AmazonItem[] = parseAppleRefurb(html);
  console.log("[whg:bg] apple refurb parsed", items.length, "items");
  return { status: "ok", items };
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

    // Google runs in its own hidden tab, serialized behind the amazon fetch
    // by the rate-limit queue; its items merge into whichever base wins.
    const directP = withRateLimit(() => searchAmazon(request)).catch((error) => {
      console.error("[whg:bg] direct fetch threw", error);
      return null;
    });
    const googleP = withRateLimit(() => searchGoogleShopping(request)).catch((error) => {
      console.error("[whg:bg] google shopping threw", error);
      return [] as AmazonItem[];
    });
    const direct = await directP;

    const directRanked = direct?.status === "ok" ? rankSource(request, direct.items, CANDIDATES) : null;
    // A 200 can still be a bot-lite page with results but stripped prices;
    // only a priced result is a real success (cacheable).
    if (directRanked && hasPrice(directRanked)) {
      const response = buildResponse(request, directRanked, await googleP);
      if (response.status === "ok" && response.stats.min !== null) await setCached(storage, key, response, TTL_OK_MS);
      return response;
    }
    if (directRanked) {
      console.warn("[whg:bg] direct path returned no priced items, trying hidden-tab fallback");
    }
    console.log("[whg:bg] direct path failed, trying hidden-tab fallback", direct?.status ?? "fetch error");

    let viaTab: RawResult | null = null;
    try {
      viaTab = await withRateLimit(() => searchViaHiddenTab(request));
    } catch (error) {
      console.error("[whg:bg] hidden tab threw", error);
    }

    // Direct wins over the tab when both answered (pre-google behavior).
    const base =
      directRanked ?? (viaTab?.status === "ok" ? rankSource(request, viaTab.items, CANDIDATES) : null);
    if (base && base.length > 0) {
      const response = buildResponse(request, base, await googleP);
      if (response.status === "ok" && response.stats.min !== null) await setCached(storage, key, response, TTL_OK_MS);
      return response;
    }

    // Apple Refurbished Store: past generations live there, not on Amazon.
    const applePath = appleRefurbPath(request.title);
    if (applePath) {
      console.log("[whg:bg] amazon found nothing relevant, trying apple refurb", applePath);
      try {
        const apple = await withRateLimit(() => searchAppleRefurb(applePath));
        const appleRanked = apple.status === "ok" ? rankSource(request, apple.items, CANDIDATES) : null;
        if (appleRanked && appleRanked.length > 0) {
          const response = buildResponse(request, appleRanked, await googleP);
          await setCached(storage, key, response, TTL_OK_MS);
          return response;
        }
        console.log("[whg:bg] apple refurb yielded no relevant items");
      } catch (error) {
        console.error("[whg:bg] apple refurb threw", error);
      }
    }

    // Amazon answered nothing usable: google-only candidates are still a real
    // price comparison — don't throw them away with the amazon block/error.
    const googleResponse = buildResponse(request, [], await googleP);
    if (googleResponse.status === "ok" && googleResponse.stats.min !== null) {
      await setCached(storage, key, googleResponse, TTL_OK_MS);
      return googleResponse;
    }

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
