import browser from "webextension-polyfill";
import { extractListing, SELECTORS, type Listing } from "../lib/extract-willhaben";
import type { SearchRequest, SearchResponse } from "../lib/protocol";
import { mountOverlay, type OverlayData, type OverlayHandle } from "./overlay";

/** willhaben.at detail pages (SPA: path can change without a page load). */
const DETAIL_PATH = /^\/iad\/kaufen-und-verkaufen\/d\//;
const NAV_POLL_MS = 500;
/** Give up waiting for the listing price after this long (title-only lookup). */
const EXTRACT_TIMEOUT_MS = 10_000;

let currentHref = "";
let observer: MutationObserver | null = null;
let extractTimer: number | null = null;
let overlay: OverlayHandle | null = null;
let overlayData: OverlayData | null = null;

function teardown(): void {
  observer?.disconnect();
  observer = null;
  if (extractTimer !== null) {
    window.clearTimeout(extractTimer);
    extractTimer = null;
  }
  overlay?.destroy();
  overlay = null;
  overlayData = null;
}

function beginLookup(listing: Listing): void {
  const anchor =
    document.querySelector(SELECTORS.price) ??
    document.querySelector(SELECTORS.priceFallback) ??
    document.querySelector(SELECTORS.title);
  if (!anchor) return;

  const searchUrl = `https://www.amazon.de/s?k=${encodeURIComponent(listing.title)}`;
  overlay = mountOverlay(anchor, (asin) => {
    if (!overlayData) return;
    overlayData = { ...overlayData, confirmedAsin: asin };
    overlay?.update(overlayData);
    void browser.storage.local.set({ [`sel:${listing.id}`]: asin }).catch(() => undefined);
  });
  void lookup(listing, searchUrl);
}

async function lookup(listing: Listing, searchUrl: string): Promise<void> {
  const selKey = `sel:${listing.id}`;
  let savedAsin: string | null = null;
  try {
    savedAsin = ((await browser.storage.local.get(selKey))[selKey] as string | undefined) ?? null;
  } catch {
    // Storage unavailable → proceed without a pre-confirmed selection.
  }

  let response: SearchResponse;
  try {
    const request: SearchRequest = {
      type: "SEARCH_AMAZON",
      listingId: listing.id,
      title: listing.title,
      priceEur: listing.priceEur,
    };
    response = (await browser.runtime.sendMessage(request)) as SearchResponse;
  } catch (error) {
    response = { status: "error", message: error instanceof Error ? error.message : String(error) };
  }

  if (!overlay) return; // navigated away while the lookup was in flight
  overlayData =
    response.status === "ok"
      ? {
          searchUrl,
          listingPriceEur: listing.priceEur,
          candidates: response.candidates,
          stats: response.stats,
          confirmedAsin: savedAsin,
        }
      : {
          searchUrl,
          listingPriceEur: listing.priceEur,
          candidates: [],
          stats: { min: null, median: null },
          confirmedAsin: null,
        };
  overlay.update(overlayData);
}

function checkNavigation(): void {
  if (location.href === currentHref) return;
  currentHref = location.href;
  teardown();
  if (!DETAIL_PATH.test(location.pathname)) return;

  let settled = false;
  let gaveUp = false;
  const tryExtract = (): void => {
    if (settled) return;
    const listing = extractListing(document);
    // Wait for the price to render; after the timeout, settle title-only.
    if (!listing || (listing.priceEur === null && !gaveUp)) return;
    settled = true;
    observer?.disconnect();
    observer = null;
    if (extractTimer !== null) {
      window.clearTimeout(extractTimer);
      extractTimer = null;
    }
    beginLookup(listing);
  };

  tryExtract();
  if (settled) return;
  if (document.body) {
    observer = new MutationObserver(tryExtract);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  extractTimer = window.setTimeout(() => {
    extractTimer = null;
    gaveUp = true;
    tryExtract();
    if (!settled) {
      observer?.disconnect();
      observer = null;
    }
  }, EXTRACT_TIMEOUT_MS);
}

checkNavigation();
setInterval(checkNavigation, NAV_POLL_MS);
