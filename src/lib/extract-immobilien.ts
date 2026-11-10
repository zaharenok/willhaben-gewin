import { parseEurDe } from "./parse-eur";
import { extractAdId } from "./extract-willhaben";
import { bezirkFromAddress } from "./bezirk-medians";

export interface ImmobilienListing {
  id: string;
  title: string;
  /** Contact-box total: "Gesamtmiete inkl. MWSt" (rent) or "Kaufpreis". */
  gesamtmieteEur: number | null;
  /** "Miete (exkl. MWSt)" — the MRG Netto-Hauptmietzins basis. */
  nettoMieteEur: number | null;
  /** "Betriebskosten (exkl. MWSt)". */
  betriebskostenEur: number | null;
  wohnflaecheM2: number | null;
  zimmer: number | null;
  bautyp: string | null;
  baujahr: number | null;
  /** e.g. "5 Jahre" — value text as rendered. */
  befristung: string | null;
  provision: string | null;
  /** Rent listing (Netto-Miete/BK rows present) vs. purchase. */
  isRent: boolean;
  /** Objektstandort → Bezirk number 1–23 ("1140 Wien, 14. Bezirk, …" → 14). */
  bezirk: number | null;
  /** Energieausweis rows as rendered (HWB, Energieklasse, fGEE, …). */
  energy: Array<{ label: string; value: string }>;
}

/**
 * Single source of truth for willhaben.at immobilien detail-page selectors.
 * Live-verified against tests/fixtures/willhaben-immobilien.html; when
 * willhaben changes markup, update this object and the fixture together.
 */
export const SELECTORS_IMM = {
  title: 'h1[data-testid="ad-detail-header"]',
  /** Contact-box total price ("Gesamtmiete inkl. MWSt" / "Kaufpreis"). */
  price: '[data-testid="contact-box-price-box-price-value"]',
  priceLegacy: '[data-testid="contact-box-price-box-price-value-0"]',
  priceFallback: '[data-testid="sticky-header-price"]',
  attributeItem: '[data-testid="attribute-item"]',
  attributeTitle: '[data-testid="attribute-title"]',
  attributeValue: '[data-testid="attribute-value"]',
  /** Preisinformation rows: "…-label-N" pairs with "…-value-N". */
  priceInfoLabelPrefix: "price-information-formatted-attribute-label-",
  priceInfoValuePrefix: "price-information-formatted-attribute-value-",
  /** Immobilien marker: the Preisinformation block or a Wohnfläche row. */
  priceInfoLabel: '[data-testid^="price-information-formatted-attribute-label-"]',
  adCode: '[data-testid="ad-detail-ad-wh-code-top"]',
  attrArea: "Wohnfläche",
  attrRooms: "Zimmer",
  attrBautyp: "Bautyp",
  attrBaujahr: "Baujahr",
  attrBefristung: "Befristung",
  attrProvision: "Provision",
  objectLocationAddress: '[data-testid="object-location-address"]',
  /** Energieausweis rows: "…-label-N" pairs with "…-value-N". */
  energyLabelPrefix: "energy-pass-attribute-label-",
  energyValuePrefix: "energy-pass-attribute-value-",
} as const;

/** Extract the immobilien listing; null on non-immobilien pages. */
export function extractImmobilien(doc: Document): ImmobilienListing | null {
  const titleEl = doc.querySelector(SELECTORS_IMM.title);
  if (!titleEl) return null;
  const title = (titleEl.textContent ?? "").trim();
  if (!title) return null;
  if (!hasImmobilienMarker(doc)) return null; // generic ads share the header

  const priceEl =
    doc.querySelector(SELECTORS_IMM.price) ??
    doc.querySelector(SELECTORS_IMM.priceLegacy) ??
    doc.querySelector(SELECTORS_IMM.priceFallback);
  const gesamtmieteEur = priceEl ? parseEurDe(priceEl.textContent ?? "") : null;

  const priceInfo = readPriceInfo(doc);
  const attrs = readAttributes(doc);
  const zimmerText = attrs.get(SELECTORS_IMM.attrRooms) ?? null;
  const baujahrText = attrs.get(SELECTORS_IMM.attrBaujahr) ?? null;
  const baujahrMatch = baujahrText?.match(/\d{4}/);

  const bezirk = bezirkFromAddress(doc.querySelector(SELECTORS_IMM.objectLocationAddress)?.textContent?.trim() ?? null);
  const energy = readEnergyPass(doc);

  const id = extractAdId(doc);
  if (!id) return null;

  return {
    id,
    title,
    gesamtmieteEur,
    nettoMieteEur: priceInfo.netto,
    betriebskostenEur: priceInfo.bk,
    wohnflaecheM2: firstGermanNumber(attrs.get(SELECTORS_IMM.attrArea) ?? null) ?? areaNearTitle(titleEl),
    zimmer: zimmerText !== null ? firstGermanNumber(zimmerText) : null,
    bautyp: attrs.get(SELECTORS_IMM.attrBautyp) ?? null,
    baujahr: baujahrMatch ? Number(baujahrMatch[0]) : null,
    befristung: attrs.get(SELECTORS_IMM.attrBefristung) ?? null,
    provision: attrs.get(SELECTORS_IMM.attrProvision) ?? null,
    isRent: priceInfo.netto !== null || priceInfo.bk !== null,
    bezirk,
    energy,
  };
}

/** Preisinformation: "Miete (exkl. MWSt)" / "Betriebskosten (exkl. MWSt)". */
function readPriceInfo(doc: Document): { netto: number | null; bk: number | null } {
  let netto: number | null = null;
  let bk: number | null = null;
  for (const labelEl of doc.querySelectorAll(`[data-testid^="${SELECTORS_IMM.priceInfoLabelPrefix}"]`)) {
    const label = (labelEl.textContent ?? "").trim();
    const testid = labelEl.getAttribute("data-testid") ?? "";
    const valueId = testid.replace(SELECTORS_IMM.priceInfoLabelPrefix, SELECTORS_IMM.priceInfoValuePrefix);
    const value = doc.querySelector(`[data-testid="${valueId}"]`);
    const eur = value ? parseEurDe(value.textContent ?? "") : null;
    if (eur === null) continue;
    // exkl. rows only — the inkl. duplicates would double-count VAT.
    if (/^Miete\s*\(/i.test(label) && /exkl/i.test(label)) netto = eur;
    else if (/^Betriebskosten\s*\(/i.test(label) && /exkl/i.test(label)) bk = eur;
  }
  return { netto, bk };
}

/** Attribute rows → label → value text. */
function readAttributes(doc: Document): Map<string, string> {
  const out = new Map<string, string>();
  for (const item of doc.querySelectorAll(SELECTORS_IMM.attributeItem)) {
    const label = item.querySelector(SELECTORS_IMM.attributeTitle)?.textContent?.trim();
    const value = item.querySelector(SELECTORS_IMM.attributeValue)?.textContent?.trim();
    if (label && value) out.set(label, value);
  }
  return out;
}

/** The Preisinformation block or a Wohnfläche row marks an immobilien page. */
function hasImmobilienMarker(doc: Document): boolean {
  if (doc.querySelector(SELECTORS_IMM.priceInfoLabel)) return true;
  for (const el of doc.querySelectorAll(SELECTORS_IMM.attributeTitle)) {
    if (el.textContent?.trim() === SELECTORS_IMM.attrArea) return true;
  }
  return false;
}

/** First German-formatted number: "131 m²" → 131, "1.234,5" → 1234.5.
 * Size ranges on project ads ("30,58–116,81 m²") → null: no single value. */
function firstGermanNumber(text: string | null): number | null {
  if (text === null) return null;
  if (/\d\s*[–-]\s*\d/.test(text)) return null;
  const m = text.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/);
  return m ? parseEurDe(m[0]) : null;
}

/** Energieausweis rows: "energy-pass-attribute-label-N" → "…-value-N" pairs. */
function readEnergyPass(doc: Document): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  for (const labelEl of doc.querySelectorAll(`[data-testid^="${SELECTORS_IMM.energyLabelPrefix}"]`)) {
    const label = (labelEl.textContent ?? "").trim().replace(/:\s*$/, "");
    const testid = labelEl.getAttribute("data-testid") ?? "";
    const valueId = testid.replace(SELECTORS_IMM.energyLabelPrefix, SELECTORS_IMM.energyValuePrefix);
    const value = doc.querySelector(`[data-testid="${valueId}"]`)?.textContent?.trim();
    if (label && value) out.push({ label, value });
  }
  return out;
}

/** Unit size next to the h1 header ("… A61,49 m² 2 Zimmer …" on project ads).
 * A size range ("46,33–62,33 m²") never matches — lookbehind rejects digits
 * glued to a dash or another number. */
function areaNearTitle(titleEl: Element): number | null {
  let node: Element | null = titleEl;
  for (let hops = 0; node && hops < 4; hops++, node = node.parentElement) {
    const m = (node.textContent ?? "").match(/(?<![\d.,–-])(\d+(?:\.\d{3})?(?:,\d+)?)\s*m²/);
    if (m) return parseEurDe(m[1]);
  }
  return null;
}
