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
      const source = c.source === "apple" ? ` <span class="whg-source">${esc(t("appleRefurb"))}</span>` : "";
      return `<button type="button" class="${cls}" data-asin="${esc(c.asin)}"><span class="whg-row-title">${esc(c.title)}${source}</span><span class="whg-row-price">${esc(price)}</span></button>`;
    })
    .join("");
  return `<div class="whg-panel"><div class="whg-panel-title">${esc(t("chooseTitle"))}</div>${rows}</div>`;
}

/**
 * Shadow-DOM badge anchored next to the listing price.
 * States: loading → ok (preview ≈ / confirmed) | fallback link
 * (blocked, error, or no parseable Amazon price).
 */
export function mountOverlay(anchor: Element, listingPriceEur: number | null, onConfirm: (asin: string) => void): OverlayHandle {
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
    // Willhaben-side of the comparison — shown in every state so the badge
    // always reads as "Willhaben €X vs Amazon …".
    const usedPrice = data?.listingPriceEur ?? listingPriceEur;
    const usedText =
      usedPrice === null ? "" : `${esc(t("badgeUsed"))} ${esc(formatEur(usedPrice))} → `;
    if (!data) {
      root.innerHTML = `<span class="whg-badge whg-loading"><span class="whg-spin" aria-hidden="true"></span><em>${esc(t("loadingHint"))}</em><span class="whg-sub">${usedText}Amazon</span></span>`;
      return;
    }
    const priced = data.candidates.filter((c) => c.priceEur !== null);
    if (data.candidates.length === 0) {
      root.innerHTML = `<a class="whg-badge whg-fallback" href="${esc(data.searchUrl)}" target="_blank" rel="noopener noreferrer">🤷 ${esc(t("noMatch"))} → ${esc(t("openSearch"))}</a>`;
      return;
    }
    if (priced.length === 0) {
      root.innerHTML = `<a class="whg-badge whg-fallback" href="${esc(data.searchUrl)}" target="_blank" rel="noopener noreferrer">${usedText}⚠ ${esc(t("blockedHint"))} → ${esc(t("openSearch"))}</a>`;
      return;
    }
    const selected = selectedCandidate(data, priced);
    const confirmed = data.confirmedAsin === selected.asin;
    const minText = data.stats.min !== null ? formatEur(data.stats.min) : "";

    // diffEur = amazon − willhaben: positive → the used listing is cheaper.
    let diff = "";
    if (data.listingPriceEur !== null && selected.priceEur !== null) {
      const { diffEur, pct } = computeSavings(data.listingPriceEur, selected.priceEur);
      const save = diffEur >= 0;
      const cls = save ? "whg-save" : "whg-cost";
      const emoji = save ? "💰" : "⚠️";
      const arrow = save ? "↓" : "↑";
      const word = save ? t("cheaper") : t("costlier");
      diff = `<span class="whg-diff ${cls}">${emoji} ${arrow} ${esc(formatEur(Math.abs(diffEur)))} (${Math.abs(pct)} %) ${esc(word)}</span>`;
    }
    const prefix = confirmed ? "" : "≈ ";
    const panel = panelOpen ? renderPanel(data, selected) : "";
    root.innerHTML =
      `<button type="button" class="whg-badge whg-main" data-whg-toggle>` +
      diff +
      `<span class="whg-sub">${usedText}${prefix}${esc(priced.every((c) => c.source === "apple") ? t("badgeRefurb") : t("badgeNew"))}: ab ${esc(minText)}</span>` +
      `</button>` +
      panel;
    if (panelOpen) {
      // position: fixed escapes the contact box's overflow clipping.
      const panelEl = root.querySelector<HTMLElement>(".whg-panel");
      if (panelEl) {
        const r = host.getBoundingClientRect();
        panelEl.style.left = `${Math.max(8, r.left)}px`;
        panelEl.style.top = `${r.bottom + 8}px`;
      }
    }
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
