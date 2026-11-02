import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAppleRefurb } from "../src/lib/parse-apple";

const html = readFileSync(resolve(process.cwd(), "tests/fixtures/apple-refurb.html"), "utf8");

describe("parseAppleRefurb", () => {
  it("extracts products from JSON-LD blocks with prices and ids", () => {
    const items = parseAppleRefurb(html);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("MacBook Pro 14 Zoll M1 Max");
    expect(items[0].priceEur).toBe(2349);
    expect(items[0].asin).toBe("apple:FHXX4D");
    expect(items[0].source).toBe("apple");
  });

  it("skips malformed JSON blocks", () => {
    const items = parseAppleRefurb('<script type="application/ld+json">{"broken"');
    expect(items).toHaveLength(0);
  });
});
