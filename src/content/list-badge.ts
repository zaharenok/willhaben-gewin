import browser from "webextension-polyfill";
import { extractRows, SELECTORS_LIST, type ListRow } from "../lib/extract-list";
import type { SearchRequest, SearchResponse } from "../lib/protocol";
import { rowBadge } from "../lib/row-view";

/** Rescan cadence — cheap querySelectorAll; catches SPA re-renders/infinite scroll. */
const SCAN_INTERVAL_MS = 800;

export interface ListAnnotations {
  stop(): void;
}

/**
 * Annotate every search-result row with a win/loss price pill. One
 * SEARCH_AMAZON message per row; the background's cache + rate limit
 * serialize and dedupe the actual lookups (badges fill in progressively).
 * Blocked/error rows stay unannotated — no fallback-link spam in a list.
 */
export function startListAnnotations(): ListAnnotations {
  let stopped = false;
  const inFlight = new Set<string>();
  const settled = new Set<string>();
  const timer = window.setInterval(scan, SCAN_INTERVAL_MS);
  scan();
  console.log("[whg:list] annotating result rows");

  return {
    stop() {
      stopped = true;
      window.clearInterval(timer);
      for (const el of document.querySelectorAll("[data-whg-row-badge]")) el.remove();
      console.log("[whg:list] stopped");
    },
  };

  function scan(): void {
    if (stopped) return;
    for (const row of extractRows(document)) {
      if (settled.has(row.id) || inFlight.has(row.id)) continue;
      inFlight.add(row.id);
      void annotate(row);
    }
  }

  async function annotate(row: ListRow): Promise<void> {
    const priceEl = row.anchor.querySelector(SELECTORS_LIST.price);
    const host = document.createElement("div");
    host.setAttribute("data-whg-row-badge", "");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>.pill{display:inline-block;font:600 12px/1.3 system-ui,sans-serif;padding:2px 8px;border-radius:999px;margin-left:6px;white-space:nowrap;vertical-align:middle}.whg-loading{color:#6b6b6b;background:#f1f1f1;border:1px solid #ddd}.win{color:#0a7d33;background:#e7f6ec;border:1px solid #b7e2c3}.loss{color:#c62828;background:#fdecea;border:1px solid #f5c6c2}.unknown{color:#6b6b6b;background:#f1f1f1;border:1px solid #ddd}</style><span class="pill whg-loading">…</span>`;
    const pill = shadow.querySelector(".pill")!;
    // Next to the row price, inside its flex container; whole card as fallback.
    if (priceEl?.parentElement) priceEl.parentElement.insertBefore(host, priceEl.nextSibling);
    else row.anchor.appendChild(host);

    let response: SearchResponse | null = null;
    try {
      const request: SearchRequest = {
        type: "SEARCH_AMAZON",
        listingId: row.id,
        title: row.title,
        priceEur: row.priceEur,
      };
      response = (await browser.runtime.sendMessage(request)) as SearchResponse;
    } catch (error) {
      console.warn("[whg:list] lookup failed", row.id, error);
    }
    inFlight.delete(row.id);
    settled.add(row.id); // terminal for this page view — never re-request
    if (stopped || !host.isConnected) return;
    const badge =
      response?.status === "ok" ? rowBadge(response.stats, row.priceEur) : null;
    if (!badge) {
      host.remove(); // blocked/error/no comparable price → no pill
      return;
    }
    pill.className = `pill ${badge.kind}`;
    pill.textContent = badge.text;
    pill.setAttribute("title", badge.tooltip);
  }
}
