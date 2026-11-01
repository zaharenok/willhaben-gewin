import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { detectBlock, parseAmazonSearch } from "../src/lib/parse-amazon";

const fixtureHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/amazon-search.html"), "utf8");

describe("parseAmazonSearch on a live amazon.de results fixture", () => {
  const items = parseAmazonSearch(fixtureHtml);

  it("parses all trimmed result rows", () => {
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(items.every((i) => i.asin && i.title)).toBe(true);
  });

  it("parses de-DE prices", () => {
    const priced = items.filter((i) => i.priceEur !== null);
    expect(priced.length).toBeGreaterThanOrEqual(10);
    expect(priced.every((i) => i.priceEur! > 0)).toBe(true);
    const refurbIphone = items.find((i) => i.asin === "B09MGFJK73");
    expect(refurbIphone?.priceEur).toBe(285);
  });
});

describe("detectBlock", () => {
  it("flags captcha/sorry markers", () => {
    expect(detectBlock("<html>Enter the characters you see below</html>")).toBe(true);
    expect(detectBlock("<html>Contact api-services-support@amazon.com</html>")).toBe(true);
    expect(detectBlock("<html><title>Tut uns Leid!</title></html>")).toBe(true);
  });

  it("does not flag a real results page", () => {
    expect(detectBlock(fixtureHtml)).toBe(false);
  });
});
