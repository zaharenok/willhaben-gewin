import css from "./overlay.css?raw";
import { t } from "../lib/i18n";
import type { AmazonItem } from "../lib/parse-amazon";
import { computeSavings, formatEur } from "../lib/savings";

export interface OverlayData {
  searchUrl: string;
  listingPriceEur: number | null;
  candidates: AmazonItem[];
  stats: { min: number | null; median: number | null };
  confirmedAsin: string | null;
}

export interface OverlayHandle {
  /** null = loading; empty candidates = fallback link state. */
  update(data: OverlayData | null): void;
  destroy(): void;
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/**
 * The candidate the badge speaks about: the user's confirmed pick, else the
 * median-priced candidate shown as unconfirmed ("≈" prefix in the badge).
 */
function selectedCandidate(data: OverlayData, priced: AmazonItem[]): AmazonItem {
  const confirmed = data.confirmedAsin
    ? data.candidates.find((c) => c.asin === data.confirmedAsin && c.priceEur !== null)
    : undefined;
  if (confirmed) return confirmed;
  return priced.find((c) => c.priceEur === data.stats.median) ?? priced[0];
}

function renderPanel(data: OverlayData, selected: AmazonItem): string {
  const rows = data.candidates
    .map((c) => {
      const cls = c.asin === selected.asin ? "whg-row whg-selected" : "whg-row";
      const price = c.priceEur !== null ? formatEur(c.priceEur) : "—";
      return `<button type="button" class="${cls}" data-asin="${esc(c.asin)}"><span class="whg-row-title">${esc(c.title)}</span><span class="whg-row-price">${esc(price)}</span></button>`;
    })
    .join("");
  return `<div class="whg-panel"><div class="whg-panel-title">${esc(t("chooseTitle"))}</div>${rows}</div>`;
}

/**
 * Shadow-DOM badge anchored next to the listing price.
 * States: loading → ok (preview ≈ / confirmed) | fallback link
 * (blocked, error, or no parseable Amazon price).
 */
export function mountOverlay(anchor: Element, onConfirm: (asin: string) => void): OverlayHandle {
  const host = document.createElement("div");
  host.setAttribute("data-whg-badge", "");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const root = document.createElement("div");
  root.className = "whg-root";
  shadow.append(style, root);
  anchor.insertAdjacentElement("afterend", host);

  let data: OverlayData | null = null;
  let panelOpen = false;

  const render = (): void => {
    if (!data) {
      root.innerHTML = `<span class="whg-badge whg-loading">⏳ Amazon…</span>`;
      return;
    }
    const priced = data.candidates.filter((c) => c.priceEur !== null);
    if (priced.length === 0) {
      root.innerHTML = `<a class="whg-badge whg-fallback" href="${esc(data.searchUrl)}" target="_blank" rel="noopener noreferrer">⚠ ${esc(t("blockedHint"))} → ${esc(t("openSearch"))}</a>`;
      return;
    }
    const selected = selectedCandidate(data, priced);
    const confirmed = data.confirmedAsin === selected.asin;
    const minText = data.stats.min !== null ? formatEur(data.stats.min) : "";

    let overpay = "";
    if (data.listingPriceEur !== null && selected.priceEur !== null) {
      const { diffEur, pct } = computeSavings(data.listingPriceEur, selected.priceEur);
      const diffSign = diffEur >= 0 ? "+" : "−";
      const pctSign = pct >= 0 ? "+" : "−";
      overpay = ` · ${esc(t("badgeOverpay"))} ${diffSign}${esc(formatEur(Math.abs(diffEur)))} (${pctSign}${Math.abs(pct)}%)`;
    }
    const prefix = confirmed ? "" : "≈ ";
    const panel = panelOpen ? renderPanel(data, selected) : "";
    root.innerHTML =
      `<button type="button" class="whg-badge whg-main" data-whg-toggle>🛒 ${prefix}${esc(t("badgeNew"))}: ab ${esc(minText)}${overpay}</button>` +
      panel;
  };

  root.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target) return;
    const row = target.closest("[data-asin]");
    if (row) {
      panelOpen = false;
      onConfirm(row.getAttribute("data-asin") ?? "");
      return;
    }
    if (target.closest("[data-whg-toggle]") && data && data.candidates.some((c) => c.priceEur !== null)) {
      panelOpen = !panelOpen;
      render();
    }
  });

  render();

  return {
    update(next) {
      data = next;
      panelOpen = false;
      render();
    },
    destroy() {
      host.remove();
    },
  };
}
