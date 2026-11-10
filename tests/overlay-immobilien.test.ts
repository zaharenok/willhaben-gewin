import { describe, expect, it } from "vitest";
import { mountImmobilienOverlay, type ImmobilienBadgeData } from "../src/content/overlay-immobilien";
import { checkRichtwert } from "../src/lib/richtwert";
import { t } from "../src/lib/i18n";
import type { ImmobilienListing } from "../src/lib/extract-immobilien";

const listing: ImmobilienListing = {
  id: "1931309349",
  title: "4 Zimmer Wohnung in Schönbrunn Nähe",
  gesamtmieteEur: 2087,
  nettoMieteEur: 1572,
  betriebskostenEur: 324.99,
  wohnflaecheM2: 131,
  zimmer: 4,
  bautyp: "Altbau",
  baujahr: null,
  befristung: "5 Jahre",
  provision: null,
  isRent: true,
  bezirk: 14,
  energy: [],
};

function badgeText(root: ShadowRoot): string {
  // style CSS ships inside the shadow root — read only the rendered root
  return (root.querySelector(".whg-root")?.textContent ?? "").replace(/\u00A0/g, " ");
}
function mount(data: ImmobilienBadgeData) {
  const anchor = document.createElement("div");
  document.body.appendChild(anchor);
  const handle = mountImmobilienOverlay(anchor, data);
  const root = anchor.nextElementSibling!.shadowRoot!;
  return { handle, root };
}

describe("immobilien detail badge", () => {
  it("renders €/m² hero, netto sub and the auffällig verdict", () => {
    const { handle, root } = mount({ listing, richtwert: checkRichtwert(listing), delta: null });
    const text = badgeText(root);
    expect(text).toContain("€ 15,93/m²"); // 2087 / 131
    expect(text).toContain(t("immNetto"));
    expect(text).toContain(t("immVerdictHigh"));
    expect(text).toContain("1,78×");
    handle.destroy();
  });

  it("opens a panel with breakdown, Richtwert, flags, disclaimer and link", () => {
    const { handle, root } = mount({ listing, richtwert: checkRichtwert(listing), delta: null });
    (root.querySelector("[data-whg-toggle]") as HTMLButtonElement).click();
    const text = badgeText(root);
    expect(text).toContain(t("immGesamt"));
    expect(text).toContain("Richtwert");
    expect(text).toContain(t("immMedian")); // Bezirk 14 → 18,46 €/m² row
    expect(text).toContain("18,46");
    expect(text).toContain("5 Jahre"); // Befristung flag from the listing
    expect(text).toContain(t("immDisclaimer"));
    expect(root.querySelector<HTMLAnchorElement>(".whg-linkrow")?.href).toContain("miete-berechnen");
    handle.destroy();
    expect(document.querySelector("[data-whg-badge]")).toBeNull();
  });

  it("shows the price delta since the last visit", () => {
    const { handle, root } = mount({
      listing,
      richtwert: checkRichtwert(listing),
      delta: { deltaEur: -63, seenTs: Date.now() },
    });
    expect(badgeText(root)).toContain("−€ 63,00");
    handle.destroy();
  });

  it("shows the annuity rate instead of a rent verdict for purchases", () => {
    const purchase: ImmobilienListing = {
      ...listing,
      isRent: false,
      nettoMieteEur: null,
      betriebskostenEur: null,
      gesamtmieteEur: 359_600,
      wohnflaecheM2: 61.49,
      bezirk: 22,
      energy: [
        { label: "HWB (kWh/m²/Jahr)", value: "24,6" },
        { label: "HWB Energieklasse", value: "A" },
      ],
    };
    const { handle, root } = mount({ listing: purchase, richtwert: checkRichtwert(purchase), delta: null });
    const text = badgeText(root);
    expect(text).toContain("€ 5.848,11/m²"); // 359 600 € / 61,49 m²
    expect(text).toContain(t("immRate")); // sub: Monatsrate (20 J., 3,60 %)
    expect(text).toContain("€ 2.104"); // annuity 359 600 € @ 3.60 % / 20 y
    expect(text).not.toContain(t("immVerdictUnknown")); // verdict only in the panel
    expect(root.querySelector(".whg-save, .whg-cost")).toBeNull();
    (root.querySelector("[data-whg-toggle]") as HTMLButtonElement).click();
    const panel = badgeText(root);
    expect(panel).toContain(t("immVerdictUnknown")); // panel title
    expect(panel).toContain(t("immEnergy"));
    expect(panel).toContain("HWB Energieklasse");
    expect(root.querySelector<HTMLAnchorElement>(".whg-linkrow")?.href).toContain("kreditzinsen");
    handle.destroy();
  });
});
