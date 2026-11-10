import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractImmobilien } from "../src/lib/extract-immobilien";

const fixtureHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-immobilien.html"), "utf8");
const genericHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-ad.html"), "utf8");
const kauFixtureHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-immobilien-kauf.html"), "utf8");
const energyFixtureHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-immobilien-energy.html"), "utf8");

describe("extractImmobilien on the live immobilien detail fixture", () => {
  const doc = new DOMParser().parseFromString(fixtureHtml, "text/html");
  const listing = extractImmobilien(doc);

  it("extracts the rent listing fields", () => {
    expect(listing).not.toBeNull();
    expect(listing!.id).toBe("1931309349");
    expect(listing!.title).toContain("4 Zimmer Wohnung");
    expect(listing!.gesamtmieteEur).toBe(2087);
    // exkl. MWSt rows — not the inkl. duplicates
    expect(listing!.nettoMieteEur).toBe(1572);
    expect(listing!.betriebskostenEur).toBe(324.99);
    expect(listing!.wohnflaecheM2).toBe(131);
    expect(listing!.zimmer).toBe(4);
    expect(listing!.bautyp).toBe("Altbau");
    expect(listing!.befristung).toBe("5 Jahre");
    expect(listing!.baujahr).toBeNull();
    expect(listing!.provision).toBeNull();
    expect(listing!.isRent).toBe(true);
    expect(listing!.bezirk).toBe(14); // "1140 Wien, 14. Bezirk, Penzing"
    expect(listing!.energy).toEqual([]); // Altbau listing ships no Energieausweis block
  });

  it("returns null on a generic used-goods ad fixture", () => {
    const generic = new DOMParser().parseFromString(genericHtml, "text/html");
    expect(extractImmobilien(generic)).toBeNull();
  });

  it("returns null without the detail header", () => {
    const other = new DOMParser().parseFromString(
      "<html><body><h1>Something else</h1></body></html>",
      "text/html",
    );
    expect(extractImmobilien(other)).toBeNull();
  });
});

describe("extractImmobilien on the Kauf fixture (project listing)", () => {
  const doc = new DOMParser().parseFromString(kauFixtureHtml, "text/html");
  const listing = extractImmobilien(doc);

  it("classifies it as a purchase with title-area fallback", () => {
    expect(listing).not.toBeNull();
    expect(listing!.id).toBe("1405241369");
    expect(listing!.gesamtmieteEur).toBe(359_600);
    expect(listing!.isRent).toBe(false);
    expect(listing!.nettoMieteEur).toBeNull();
    expect(listing!.betriebskostenEur).toBeNull();
    // attribute area is a project range "30,58–116,81 m²" → unit size from h1
    expect(listing!.wohnflaecheM2).toBe(61.49);
    expect(listing!.zimmer).toBe(2);
    expect(listing!.bezirk).toBe(22);
    expect(listing!.energy).toHaveLength(4);
    expect(listing!.energy).toContainEqual({ label: "HWB Energieklasse", value: "A" });
    expect(listing!.energy).toContainEqual({ label: "fGEE Energieklasse", value: "A" });
  });
});

describe("extractImmobilien on the energy fixture (Neubau rent)", () => {
  const doc = new DOMParser().parseFromString(energyFixtureHtml, "text/html");
  const listing = extractImmobilien(doc);

  it("parses rent rows, district and the Energieausweis", () => {
    expect(listing).not.toBeNull();
    expect(listing!.id).toBe("1106280746");
    expect(listing!.isRent).toBe(true);
    expect(listing!.gesamtmieteEur).toBe(1799);
    // only "Gesamtmiete (exkl. MWSt)" rows — no MRG Hauptmietzins row
    expect(listing!.nettoMieteEur).toBeNull();
    expect(listing!.betriebskostenEur).toBe(149.59);
    // attr range "46,33–62,33 m²" → unit size from the header; 62,33 m² pairs
    // with the contact price €1.799 (both tops of their ranges)
    expect(listing!.wohnflaecheM2).toBe(62.33);
    expect(listing!.bezirk).toBe(15);
    expect(listing!.energy).toHaveLength(4);
    expect(listing!.energy).toContainEqual({ label: "HWB (kWh/m²/Jahr)", value: "26,5" });
    expect(listing!.energy).toContainEqual({ label: "fGEE Energieklasse", value: "A+" });
  });
});
