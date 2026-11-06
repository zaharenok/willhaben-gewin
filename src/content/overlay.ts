import css from "./overlay.css?raw";
import { t, type MsgKey } from "../lib/i18n";
import type { AmazonItem } from "../lib/parse-amazon";
import { amazonProductUrl } from "../lib/amazon-links";
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

/** Badge sub-label by the priced candidates' source mix. */
function badgeLabelKey(priced: AmazonItem[]): MsgKey {
  const sources = priced.map((c) => c.source ?? "amazon");
  if (sources.every((s) => s === "google")) return "badgeGoogle";
  if (sources.every((s) => s === "apple")) return "badgeRefurb";
  if (sources.every((s) => s === "amazon")) return "badgeNew";
  return "badgeCompare";
}
function renderPanel(data: OverlayData, selected: AmazonItem): string {
  const rows = data.candidates
    .map((c) => {
      const cls = c.asin === selected.asin ? "whg-row whg-selected" : "whg-row";
      const price = c.priceEur !== null ? formatEur(c.priceEur) : "—";
      const tag =
        c.source === "apple"
          ? esc(t("appleRefurb"))
          : c.source === "google"
            ? esc(c.shop ?? "Google Shopping")
            : "";
      const source = tag ? ` <span class="whg-source">${tag}</span>` : "";
      const buy =
        c.source === "google"
          ? `<a class="whg-buy" href="${esc(c.url?.startsWith("http") ? c.url : `https://www.google.com/search?udm=28&q=${encodeURIComponent(c.title)}`)}" target="_blank" rel="noopener noreferrer" title="${esc(c.title)}">${esc(c.shop ?? "Google")}↗</a>`
          : c.source === "apple"
            ? `<a class="whg-buy" href="${esc(c.url?.startsWith("http") ? c.url : `https://www.apple.com${c.url ?? "/at/shop/refurbished/mac"}`)}" target="_blank" rel="noopener noreferrer" title="${esc(c.title)}">↗</a>`
            : `<a class="whg-buy" href="${esc(amazonProductUrl(c.asin))}" target="_blank" rel="noopener noreferrer" title="${esc(c.title)}">Amazon↗</a>`;
      return `<div class="${cls}" data-asin="${esc(c.asin)}"><span class="whg-row-title">${esc(c.title)}${source}</span><span class="whg-row-price">${esc(price)}</span>${buy}</div>`;
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
    const googleUrl = `https://www.google.com/search?udm=28&q=${encodeURIComponent(new URL(data.searchUrl).searchParams.get("k") ?? "")}`;
    if (data.candidates.length === 0 || priced.length === 0) {
      const hint = data.candidates.length === 0 ? `🤷 ${esc(t("noMatch"))}` : `${usedText}⚠ ${esc(t("blockedHint"))}`;
      const linkPanel = panelOpen
        ? `<div class="whg-panel"><div class="whg-panel-title">${esc(t("chooseTitle"))}</div>` +
          `<a class="whg-row whg-linkrow" href="${esc(data.searchUrl)}" target="_blank" rel="noopener noreferrer"><span class="whg-row-title">${esc(t("openSearch"))} ↗</span></a>` +
          `<a class="whg-row whg-linkrow" href="${googleUrl}" target="_blank" rel="noopener noreferrer"><span class="whg-row-title">${esc(t("openGoogle"))} ↗</span></a></div>`
        : "";
      root.innerHTML =
        `<button type="button" class="whg-badge whg-fallback" data-whg-toggle><span class="whg-sub">${hint}</span></button>` +
        linkPanel;
      if (panelOpen) {
        const panelEl = root.querySelector<HTMLElement>(".whg-panel");
        if (panelEl) {
          const r = host.getBoundingClientRect();
          panelEl.style.left = `${Math.max(8, r.left)}px`;
          panelEl.style.top = `${r.bottom + 8}px`;
        }
      }
      return;
    }
    const selected = selectedCandidate(data, priced);
    const confirmed = data.confirmedAsin === selected.asin;
    const minText = data.stats.min !== null ? formatEur(data.stats.min) : "";

    // The winning side gets the chip: used cheaper → highlight the Willhaben
    // price; the new price cheaper → highlight the "ab" price.
    const usedWins =
      data.listingPriceEur !== null && selected.priceEur !== null && selected.priceEur > data.listingPriceEur;
    const newWins =
      data.listingPriceEur !== null && selected.priceEur !== null && selected.priceEur < data.listingPriceEur;
    const win = (text: string): string => `<span class="whg-win">${text}</span>`;
    const usedPart =
      usedPrice === null
        ? ""
        : usedWins
          ? `${esc(t("badgeUsed"))} ${win(`${esc(formatEur(usedPrice))}`)} → `
          : usedText;
    const minPart = minText === "" ? "" : newWins ? `ab ${win(esc(minText))}` : `ab ${esc(minText)}`;

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
      `<span class="whg-sub">${usedPart}${prefix}${esc(t(badgeLabelKey(priced)))}: ${minPart}</span>` +
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
    if (target.closest("[data-whg-toggle]") && data) {
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
