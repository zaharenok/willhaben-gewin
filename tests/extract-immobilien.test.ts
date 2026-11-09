import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractImmobilien } from "../src/lib/extract-immobilien";

const fixtureHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-immobilien.html"), "utf8");
const genericHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-ad.html"), "utf8");

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
