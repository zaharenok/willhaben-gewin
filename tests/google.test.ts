import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isGoogleBlockOrConsent, parseGoogleShopping } from "../src/lib/parse-google";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

// Synthetic markup following the parser's documented heuristics — pins the
// parser's behavior until the live fixture (tests/fixtures/google-shopping.html)
// exists; that fixture then pins the real markup contract and the parser is
// fixed against it in the same change.
const RESULTS = `
  <html><body>
    <a href="https://www.google.com/shopping/product/111?q=x">
      <span><span role="heading">Apple Mac Studio 2022 M1 Max Chip 32GB</span></span>
      <span>€ 1.524,75</span>
      <span>refurbed.at</span>
    </a>
    <a href="./shopping/product/222">
      <h3>Apple Mac Studio M1 Max</h3>
      <span>€ 2.099,00</span>
      <span>Alza.at</span>
    </a>
    <a href="/shopping/product/333">
      <span role="heading">Apple Mac Studio M1 Max 32 GB</span>
    </a>
  </body></html>`;

const DUPLICATE_URL = `
  <html><body>
    <a href="/shopping/product/777"><span role="heading">Apple Mac Studio M1 Max</span><span>€ 1.524,75</span></a>
    <a href="/shopping/product/777"><span role="heading">Apple Mac Studio M1 Max</span><span>€ 1.600,00</span></a>
  </body></html>`;

const NO_PRODUCT_LINKS = `
  <html><body>
    <a href="https://alza.at/mac-studio"><h3>Apple Mac Studio M1 Max 32 GB Computer</h3><span>€ 1.999,-</span></a>
    <a href="https://shop.at/mini"><span>Mac mini</span><span>€ 99,00</span></a>
    <a href="https://shop.at/ohne"><span>Apple Mac Studio M1 Max ohne Preisangabe</span></a>
  </body></html>`;

describe("parseGoogleShopping", () => {
  it("parses primary product cards with title, price and shop", () => {
    const items = parseGoogleShopping(parse(RESULTS));
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      title: "Apple Mac Studio 2022 M1 Max Chip 32GB",
      priceEur: 1524.75,
      shop: "refurbed.at",
      url: "https://www.google.com/shopping/product/111?q=x",
    });
    expect(items[1].title).toBe("Apple Mac Studio M1 Max");
    expect(items[1].priceEur).toBe(2099);
    expect(items[1].url).toBe("https://www.google.com/shopping/product/222");
  });

  it("falls back to the default shop when no merchant span exists", () => {
    const items = parseGoogleShopping(parse(RESULTS));
    expect(items[2].shop).toBe("Google Shopping");
    expect(items[2].priceEur).toBeNull();
  });

  it("dedupes by resolved URL", () => {
    const items = parseGoogleShopping(parse(DUPLICATE_URL));
    expect(items).toHaveLength(1);
    expect(items[0].priceEur).toBe(1524.75);
  });

  it("falls back to priced anchors when no /shopping/product/ links exist", () => {
    const items = parseGoogleShopping(parse(NO_PRODUCT_LINKS));
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Apple Mac Studio M1 Max 32 GB Computer");
    expect(items[0].priceEur).toBe(1999);
    expect(items[0].shop).toBe("Google Shopping");
  });

  it("returns empty for a page without results", () => {
    expect(parseGoogleShopping(parse("<html><body><p>nothing here</p></body></html>"))).toEqual([]);
  });
});

describe("isGoogleBlockOrConsent", () => {
  it("detects the /sorry/ redirect (URL left in the title)", () => {
    const sorry = `<html><head><title>https://www.google.com/sorry/index?continue=x&q=Eh</title></head><body>unusual traffic</body></html>`;
    expect(isGoogleBlockOrConsent(parse(sorry))).toBe(true);
  });

  it("detects the German and English consent walls", () => {
    expect(isGoogleBlockOrConsent(parse("<html><body><p>Vor dem Fortfahren</p></body></html>"))).toBe(true);
    expect(isGoogleBlockOrConsent(parse("<html><body><p>Before you continue</p></body></html>"))).toBe(true);
  });

  it("detects a reCAPTCHA script tag", () => {
    const recaptcha = `<html><head><script src="https://www.google.com/recaptcha/api.js"></script></head><body></body></html>`;
    expect(isGoogleBlockOrConsent(parse(recaptcha))).toBe(true);
  });

  it("accepts a normal results page", () => {
    expect(isGoogleBlockOrConsent(parse(RESULTS))).toBe(false);
  });
});

// --- Live fixture (udm=28 pla-unit markup) — the markup contract. ---
const fixtureHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/google-shopping.html"), "utf8");
const fixtureDoc = new DOMParser().parseFromString(fixtureHtml, "text/html");

describe("parseGoogleShopping against the live fixture", () => {
  const items = parseGoogleShopping(fixtureDoc);

  it("parses the pla-unit offer cards (>10 items with title, price, shop)", () => {
    expect(items.length).toBeGreaterThan(10);
    const first = items[0];
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.priceEur).not.toBeNull();
    expect(first.shop).toContain(".");
    expect(first.url.startsWith("https://www.google.com/")).toBe(true);
  });

  it("finds the refurbed.at Mac Studio offer at 1524.75", () => {
    const refurbed = items.find((i) => i.shop === "refurbed.at" && /Mac Studio 2022 M1 Max/.test(i.title));
    expect(refurbed).toBeDefined();
    expect(refurbed!.priceEur).toBeCloseTo(1524.75, 2);
  });

  it("fixture page is not a block or consent page", () => {
    expect(isGoogleBlockOrConsent(fixtureDoc)).toBe(false);
  });
});
