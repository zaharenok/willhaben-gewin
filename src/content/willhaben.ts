import browser from "webextension-polyfill";
import { extractListing, SELECTORS, type Listing } from "../lib/extract-willhaben";
import { searchQueryFor } from "../lib/match";
import { amazonSearchUrl } from "../lib/amazon-links";
import type { SearchRequest, SearchResponse } from "../lib/protocol";
import { mountOverlay, type OverlayData, type OverlayHandle } from "./overlay";
import { startListAnnotations, type ListAnnotations } from "./list-badge";
import { readSettings, SETTINGS_KEY, type Settings } from "../lib/settings";

/** willhaben.at detail pages (SPA: path can change without a page load). */
const DETAIL_PATH = /^\/iad\/kaufen-und-verkaufen\/d\//;
/** List pages (search results, categories) — everything under the section except details. */
const LIST_PATH = /^\/iad\/kaufen-und-verkaufen\//;
const NAV_POLL_MS = 500;
/** Give up waiting for the listing price after this long (title-only lookup). */
const EXTRACT_TIMEOUT_MS = 10_000;

console.log("[whg] content script loaded", location.href);

let currentHref = "";
let observer: MutationObserver | null = null;
let extractTimer: number | null = null;
let overlay: OverlayHandle | null = null;
let overlayData: OverlayData | null = null;
let listController: ListAnnotations | null = null;

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

/** The sticky-header price lives in a cramped top bar — never anchor there.
 * Wait briefly for the contact-box price (SPA renders it late); the title
 * heading is the last resort. */
const ANCHOR_WAIT_MS = 5000;
const ANCHOR_POLL_MS = 300;

function pickAnchor(): Element | null {
  const candidates = [
    document.querySelector(SELECTORS.price),
    document.querySelector(SELECTORS.priceLegacy),
    document.querySelector(SELECTORS.title),
  ].filter((el): el is Element => el !== null);
  return candidates.find((el) => el.getClientRects().length > 0) ?? null;
}

function beginLookup(listing: Listing): void {
  console.log("[whg] listing extracted", {
    id: listing.id,
    title: listing.title,
    priceEur: listing.priceEur,
    conditionText: listing.conditionText,
  });

  const mount = (anchor: Element): void => {
    const searchUrl = amazonSearchUrl(searchQueryFor(listing.title));
    console.log("[whg] badge anchor", `${anchor.tagName}.${anchor.getAttribute("data-testid") ?? ""}`);
    overlay = mountOverlay(anchor, listing.priceEur, (asin) => {
      if (!overlayData) return;
      overlayData = { ...overlayData, confirmedAsin: asin };
      overlay?.update(overlayData);
      void browser.storage.local.set({ [`sel:${listing.id}`]: asin }).catch(() => undefined);
    });
    void lookup(listing, searchUrl);
  };

  const startedAt = Date.now();
  const hrefAtStart = location.href;
  const tryAnchor = (): void => {
    if (location.href !== hrefAtStart) return; // SPA navigated away
    const anchor = pickAnchor();
    if (anchor) {
      // Willhaben's PayLivery financing badge shares the price row and
      // squeezes our badge — mount BELOW it when it's there.
      const paylivery = document.querySelector('[data-testid="contact-box-paylivery-badge"]');
      // …mount AFTER ITS ROW (parent) — inserting after the badge itself keeps
      // us inside the same horizontal flex row.
      const below = paylivery && anchor.compareDocumentPosition(paylivery) & Node.DOCUMENT_POSITION_FOLLOWING ? paylivery.parentElement ?? paylivery : anchor;
      mount(below);
      return;
    }
    if (Date.now() - startedAt < ANCHOR_WAIT_MS) {
      setTimeout(tryAnchor, ANCHOR_POLL_MS);
      return;
    }
    console.warn("[whg] no anchor element found — badge not rendered");
  };
  tryAnchor();
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
    console.log("[whg] → SEARCH_AMAZON", { title: request.title, priceEur: request.priceEur });
    response = (await browser.runtime.sendMessage(request)) as SearchResponse;
    console.log("[whg] ← response", response.status, response.status === "ok" ? response.stats : response);
  } catch (error) {
    console.warn("[whg] sendMessage failed", error);
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

function stopList(): void {
  listController?.stop();
  listController = null;
}

/** Detail pages always show the badge; list pages only when the setting is on. */
async function applyMode(): Promise<void> {
  const href = location.href;
  let settings: Settings;
  try {
    settings = await readSettings(browser.storage.local);
  } catch {
    settings = { listMode: false };
  }
  if (location.href !== href) return; // SPA navigated while reading settings
  if (DETAIL_PATH.test(location.pathname)) return;
  if (LIST_PATH.test(location.pathname) && settings.listMode) {
    if (!listController) listController = startListAnnotations();
  } else {
    stopList();
  }
}
function checkNavigation(): void {
  if (location.href === currentHref) return;
  currentHref = location.href;
  teardown();
  stopList();
  if (!DETAIL_PATH.test(location.pathname)) {
    console.log("[whg] not a detail page", location.pathname);
    void applyMode();
    return;
  }

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
      console.warn("[whg] listing NOT found after 10s", {
        hasTitleEl: !!document.querySelector(SELECTORS.title),
        hasPriceEl: !!document.querySelector(SELECTORS.price),
        h1s: document.querySelectorAll("h1").length,
      });
      observer?.disconnect();
      observer = null;
    }
  }, EXTRACT_TIMEOUT_MS);
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(SETTINGS_KEY in changes)) return;
  if (DETAIL_PATH.test(location.pathname)) return;
  void applyMode();
});

checkNavigation();
setInterval(checkNavigation, NAV_POLL_MS);
