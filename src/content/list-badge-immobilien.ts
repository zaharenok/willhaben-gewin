import { extractRows, type ListRow } from "../lib/extract-list";
import { parseEurDe } from "../lib/parse-eur";
import { ROW_PILL_CSS } from "../lib/row-view";
import { t } from "../lib/i18n";
import { formatPerM2 } from "../lib/savings";
import { bezirkFromHref, rentMedianForBezirk } from "../lib/bezirk-medians";

/** Rescan cadence — same as the Amazon list annotator. */
const SCAN_INTERVAL_MS = 800;

/** Willhaben computes €/m² itself: "search-result-entry-price-per-sqmeter-<id>". */
const PER_SQM_SELECTOR = '[data-testid^="search-result-entry-price-per-sqmeter-"]';

export interface ImmobilienListAnnotations {
  stop(): void;
}

interface RowPill {
  host: HTMLElement;
  pill: Element;
  perM2: number;
  /** Bezirk median €/m² from the row href; null when the district is unknown. */
  median: number | null;
}

/**
 * Annotate immobilien search-result rows with their €/m²: colored against the
 * Bezirk median from the row href when the district is known (green ≤ median),
 * else page-relative terciles (≥3 rows, otherwise neutral). Purely local — no
 * network, no background round-trips, so even 30 rows stay instant and the
 * MV3 handler cap is irrelevant. Rows without a €/m² get no pill at all
 * (never a stuck dot).
 */
export function startImmobilienListAnnotations(): ImmobilienListAnnotations {
  const pills = new Map<string, RowPill>();
  const timer = window.setInterval(scan, SCAN_INTERVAL_MS);
  scan();
  console.log("[whg:immolist] annotating €/m²");

  const halt = (): void => {
    window.clearInterval(timer);
    for (const el of document.querySelectorAll("[data-whg-row-badge]")) el.remove();
  };

  return {
    stop() {
      halt();
      console.log("[whg:immolist] stopped");
    },
  };

  function scan(): void {
    for (const [id, p] of pills) {
      if (!p.host.isConnected) pills.delete(id); // SPA filtered the row away
    }
    for (const row of extractRows(document)) {
      if (pills.has(row.id)) continue;
      const perM2El = row.anchor.querySelector(PER_SQM_SELECTOR);
      if (!perM2El) continue;
      const perM2 = parseEurDe(perM2El.textContent ?? "");
      if (perM2 === null || perM2 <= 0) continue; // no €/m² → no pill
      const median = rentMedianForBezirk(bezirkFromHref(row.anchor.getAttribute("href")));
      pills.set(row.id, mount(row, perM2El, perM2, median));
    }
    recolor();
  }

  function mount(row: ListRow, ref: Element, perM2: number, median: number | null): RowPill {
    const host = document.createElement("div");
    host.setAttribute("data-whg-row-badge", "");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${ROW_PILL_CSS}</style><span class="pill unknown">…</span>`;
    const pill = shadow.querySelector(".pill")!;
    // Next to willhaben's own €/m² text; whole card as fallback.
    if (ref.parentElement) ref.parentElement.insertBefore(host, ref.nextSibling);
    else row.anchor.appendChild(host);
    return { host, pill, perM2, median };
  }

  /** Rows with a district median compare against it (green ≤ median); rows
   * without fall back to page-relative terciles (≥3, else neutral). */
  function recolor(): void {
    const free = [...pills.values()].filter((p) => p.median === null);
    const values = free.map((p) => p.perM2).sort((a, b) => a - b);
    const neutral = values.length < 3;
    const cheapCut = values[Math.round((values.length - 1) / 3)];
    const dearCut = values[Math.round((2 * (values.length - 1)) / 3)];
    for (const p of pills.values()) {
      let kind: "win" | "loss" | "unknown";
      let title: string;
      if (p.median !== null) {
        kind = p.perM2 <= p.median ? "win" : "loss";
        title = `${t("immMedian")}: ${formatPerM2(p.median)} · Q1 2026`;
      } else {
        kind = neutral ? "unknown" : p.perM2 <= cheapCut ? "win" : p.perM2 >= dearCut ? "loss" : "unknown";
        title = t("immListTooltip");
      }
      p.pill.className = `pill ${kind}`;
      p.pill.textContent = formatPerM2(p.perM2);
      p.pill.setAttribute("title", title);
    }
  }
}
