import css from "./overlay.css?raw";
import { esc } from "./overlay";
import { t, type MsgKey } from "../lib/i18n";
import { formatEur, formatPerM2 } from "../lib/savings";
import {
  RICHTWERT_CEILING_EUR_M2,
  RICHTWERT_EUR_M2,
  type RichtwertResult,
  type RichtwertVerdict,
} from "../lib/richtwert";
import type { ImmobilienListing } from "../lib/extract-immobilien";
import type { PriceDelta } from "../lib/price-history";
import { monthlyRate } from "../lib/financing";
import { rentMedianForBezirk } from "../lib/bezirk-medians";

export interface ImmobilienBadgeData {
  listing: ImmobilienListing;
  richtwert: RichtwertResult;
  delta: PriceDelta | null;
}

export interface ImmobilienOverlayHandle {
  update(data: ImmobilienBadgeData): void;
  destroy(): void;
}

const VERDICT_KEYS: Record<RichtwertVerdict, MsgKey> = {
  plausibel: "immVerdictOk",
  auffaellig: "immVerdictHigh",
  unklar: "immVerdictUnknown",
};

const WIEN_MIETENRECHNER_URL = "https://www.wien.gv.at/wohnen/miete-berechnen";
const KREDITZINSEN_URL = "https://durchblicker.at/kreditzinsen";

function formatDate(ts: number): string {
  const lang = typeof navigator !== "undefined" ? navigator.language : "de-AT";
  try {
    return new Date(ts).toLocaleDateString(lang);
  } catch {
    return "";
  }
}

/**
 * Shadow-DOM badge for immobilien detail pages: €/m² hero + Richtwert
 * verdict, expandable panel with the rent breakdown. Purely local — no
 * lookups, so the badge renders complete on mount (the price delta arrives
 * via update() once storage answers).
 */
export function mountImmobilienOverlay(anchor: Element, initial: ImmobilienBadgeData): ImmobilienOverlayHandle {
  const host = document.createElement("div");
  host.setAttribute("data-whg-badge", "");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const root = document.createElement("div");
  root.className = "whg-root";
  shadow.append(style, root);
  anchor.insertAdjacentElement("afterend", host);

  let data = initial;
  let panelOpen = false;

  const render = (): void => {
    const { listing, richtwert, delta } = data;
    const totalPerM2 =
      listing.gesamtmieteEur !== null && listing.wohnflaecheM2 !== null && listing.wohnflaecheM2 > 0
        ? listing.gesamtmieteEur / listing.wohnflaecheM2
        : null;
    const hero =
      totalPerM2 !== null
        ? formatPerM2(totalPerM2)
        : richtwert.nettoPerM2 !== null
          ? formatPerM2(richtwert.nettoPerM2)
          : listing.gesamtmieteEur !== null
            ? formatEur(listing.gesamtmieteEur)
            : "…";
    const heroCls =
      richtwert.verdict === "plausibel" ? "whg-save" : richtwert.verdict === "auffaellig" ? "whg-cost" : "";
    const ratioPart = richtwert.ratio !== null ? ` (${richtwert.ratio.toFixed(2).replace(".", ",")}×)` : "";
    const rate = listing.isRent || listing.gesamtmieteEur === null ? null : monthlyRate(listing.gesamtmieteEur);
    const subBits = [
      richtwert.nettoPerM2 !== null ? `${t("immNetto")} ${formatPerM2(richtwert.nettoPerM2)}` : "",
      rate !== null ? `${t("immRate")}: ${formatEur(rate)}` : "",
      listing.isRent ? `${t(VERDICT_KEYS[richtwert.verdict])}${ratioPart}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const deltaPart = delta
      ? ` · ${delta.deltaEur < 0 ? "↓" : "↑"} ${delta.deltaEur > 0 ? "+" : "−"}${formatEur(Math.abs(delta.deltaEur))} ${t("immSince")} ${formatDate(delta.seenTs)}`
      : "";
    root.innerHTML =
      `<button type="button" class="whg-badge whg-main" data-whg-toggle>` +
      `<span class="whg-diff ${heroCls}">${esc(hero)}</span>` +
      `<span class="whg-sub">${esc(subBits)}${esc(deltaPart)}</span>` +
      `</button>` +
      (panelOpen ? renderPanel(data) : "");
    if (panelOpen) positionPanel();
  };

  function renderPanel({ listing, richtwert, delta }: ImmobilienBadgeData): string {
    const rows: Array<[string, string]> = [];
    const infoUrl = listing.isRent ? WIEN_MIETENRECHNER_URL : KREDITZINSEN_URL;
    const infoKey: MsgKey = listing.isRent ? "immRichtwertInfo" : "immRateInfo";
    if (listing.isRent) {
      if (listing.gesamtmieteEur !== null) rows.push([t("immGesamt"), formatEur(listing.gesamtmieteEur)]);
      if (listing.nettoMieteEur !== null) rows.push([t("immNetto"), formatEur(listing.nettoMieteEur)]);
      if (listing.betriebskostenEur !== null) rows.push([t("immBk"), formatEur(listing.betriebskostenEur)]);
    } else if (listing.gesamtmieteEur !== null) {
      rows.push([t("immPrice"), formatEur(listing.gesamtmieteEur)]);
    }
    if (listing.wohnflaecheM2 !== null) rows.push([t("immArea"), `${listing.wohnflaecheM2} m²`]);
    if (richtwert.nettoPerM2 !== null) {
      rows.push([`${t("immNetto")}/m²`, formatPerM2(richtwert.nettoPerM2)]);
      rows.push(["Richtwert", `${formatPerM2(RICHTWERT_EUR_M2)} · max ${formatPerM2(RICHTWERT_CEILING_EUR_M2)}`]);
    }
    const median = rentMedianForBezirk(listing.bezirk);
    if (listing.isRent && median !== null) {
      rows.push([`${t("immMedian")} (${listing.bezirk}.)`, `${formatPerM2(median)} · Q1 2026`]);
    }
    if (!listing.isRent && listing.gesamtmieteEur !== null) {
      const rate = monthlyRate(listing.gesamtmieteEur);
      if (rate !== null) rows.push([t("immRate"), formatEur(rate)]);
    }
    if (listing.energy.length > 0) rows.push([t("immEnergy"), ""]);
    for (const { label, value } of listing.energy) rows.push([label, value]);
    const rowHtml = rows
      .map(
        ([k, v]) =>
          `<div class="whg-row"><span class="whg-row-title">${esc(k)}</span><span class="whg-row-price">${esc(v)}</span></div>`,
      )
      .join("");
    const flags: string[] = [];
    if (listing.befristung) flags.push(`Befristung: ${listing.befristung}`);
    if (listing.provision) flags.push(`Provision: ${listing.provision}`);
    const deltaRow = delta
      ? `<div class="whg-row"><span class="whg-row-title">${esc(t("immSince"))} ${esc(formatDate(delta.seenTs))}</span><span class="whg-row-price">${delta.deltaEur > 0 ? "+" : "−"}${esc(formatEur(Math.abs(delta.deltaEur)))}</span></div>`
      : "";
    return (
      `<div class="whg-panel"><div class="whg-panel-title">${esc(t(VERDICT_KEYS[richtwert.verdict]))}</div>` +
      rowHtml +
      deltaRow +
      (flags.length ? `<div class="whg-row"><span class="whg-row-title">${esc(flags.join(" · "))}</span></div>` : "") +
      `<div class="whg-row"><span class="whg-row-title">${esc(t("immDisclaimer"))}</span></div>` +
      `<a class="whg-row whg-linkrow" href="${infoUrl}" target="_blank" rel="noopener noreferrer"><span class="whg-row-title">${esc(t(infoKey))} ↗</span></a></div>`
    );
  }

  function positionPanel(): void {
    // position: fixed escapes the contact box's overflow clipping.
    const panelEl = root.querySelector<HTMLElement>(".whg-panel");
    if (!panelEl) return;
    const r = host.getBoundingClientRect();
    panelEl.style.left = `${Math.max(8, r.left)}px`;
    panelEl.style.top = `${r.bottom + 8}px`;
  }

  root.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest("[data-whg-toggle]")) {
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
