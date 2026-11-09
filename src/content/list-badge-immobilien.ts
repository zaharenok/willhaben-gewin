import { extractRows, type ListRow } from "../lib/extract-list";
import { parseEurDe } from "../lib/parse-eur";
import { ROW_PILL_CSS } from "../lib/row-view";
import { t } from "../lib/i18n";
import { formatPerM2 } from "../lib/savings";

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
}

/**
 * Annotate immobilien search-result rows with their €/m² and a page-relative
 * color: cheapest third green, dearest third red (only with ≥3 rows; below
 * that all neutral). Purely local — no network, no background round-trips,
 * so even 30 rows stay instant and the MV3 handler cap is irrelevant.
 * Rows without a €/m² get no pill at all (never a stuck dot).
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
      pills.set(row.id, mount(row, perM2El, perM2));
    }
    recolor();
  }

  function mount(row: ListRow, ref: Element, perM2: number): RowPill {
    const host = document.createElement("div");
    host.setAttribute("data-whg-row-badge", "");
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${ROW_PILL_CSS}</style><span class="pill unknown">…</span>`;
    const pill = shadow.querySelector(".pill")!;
    // Next to willhaben's own €/m² text; whole card as fallback.
    if (ref.parentElement) ref.parentElement.insertBefore(host, ref.nextSibling);
    else row.anchor.appendChild(host);
    return { host, pill, perM2 };
  }

  /** Terciles over all mounted rows; late/infinite-scroll rows shift the cuts. */
  function recolor(): void {
    const values = [...pills.values()].map((p) => p.perM2).sort((a, b) => a - b);
    const neutral = values.length < 3;
    const cheapCut = values[Math.round((values.length - 1) / 3)];
    const dearCut = values[Math.round((2 * (values.length - 1)) / 3)];
    for (const { pill, perM2 } of pills.values()) {
      const kind = neutral ? "unknown" : perM2 <= cheapCut ? "win" : perM2 >= dearCut ? "loss" : "unknown";
      pill.className = `pill ${kind}`;
      pill.textContent = formatPerM2(perM2);
      pill.setAttribute("title", t("immListTooltip"));
    }
  }
}
