import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractListing, SELECTORS } from "../src/lib/extract-willhaben";

const fixtureHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-ad.html"), "utf8");

describe("extractListing on a live willhaben detail-page fixture", () => {
  const doc = new DOMParser().parseFromString(fixtureHtml, "text/html");
  const listing = extractListing(doc);

  it("extracts the listing", () => {
    expect(listing).not.toBeNull();
    expect(listing!.title).toContain("Iphone 13");
    expect(listing!.priceEur).toBe(279);
    expect(listing!.conditionText).toBe("Gebraucht");
    expect(listing!.id).toMatch(/^\d{6,}$/);
  });

  it("reads the id from the willhaben-Code element", () => {
    const codeText = doc.querySelector(SELECTORS.adCode)?.textContent ?? "";
    expect(codeText).toContain(listing!.id);
  });

  it("returns null on a page without the detail header", () => {
    const other = new DOMParser().parseFromString(
      "<html><body><h1>Something else</h1></body></html>",
      "text/html",
    );
    expect(extractListing(other)).toBeNull();
  });
});
