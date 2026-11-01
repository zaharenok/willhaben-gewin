import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractListing } from "../src/lib/extract-willhaben";
import { rankCandidates, scoreMatch } from "../src/lib/match";
import { parseAmazonSearch } from "../src/lib/parse-amazon";

const willhabenHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-ad.html"), "utf8");
const amazonHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/amazon-search.html"), "utf8");

describe("scoreMatch", () => {
  it("scores a true match above noisy candidates", () => {
    const query = "Apple iPhone 13 128GB Mitternacht";
    const right = scoreMatch(query, "Apple iPhone 13, 128GB, Mitternacht (Generalüberholt)");
    const noise = [
      "Samsung Galaxy A07 4GB/128GB Schwarz",
      "vivo Y21 5G Smartphone 4GB+256GB",
      "OnePlus Nord 2 5G 128GB Gray Sierra",
    ];
    expect(right).toBeGreaterThan(0.9);
    for (const candidate of noise) {
      expect(right).toBeGreaterThan(scoreMatch(query, candidate));
    }
  });

  it("rewards number tokens (model, size) double", () => {
    const withModel = scoreMatch("iPhone 13 128GB", "Apple iPhone 13 128GB");
    const withoutModel = scoreMatch("iPhone 13 128GB", "Apple iPhone 128GB");
    expect(withModel).toBeGreaterThan(withoutModel);
  });

  it("returns 0 for empty inputs", () => {
    expect(scoreMatch("", "anything")).toBe(0);
    expect(scoreMatch("iphone", "")).toBe(0);
  });
});

describe("rankCandidates with both live fixtures", () => {
  const listing = extractListing(new DOMParser().parseFromString(willhabenHtml, "text/html"));
  const ranked = rankCandidates(listing!, parseAmazonSearch(amazonHtml), 3);

  it("puts the real iPhone 13 first among noisy candidates", () => {
    expect(ranked).toHaveLength(3);
    expect(ranked[0].title).toMatch(/iphone 13/i);
  });

  it("keeps only the top n", () => {
    expect(rankCandidates(listing!, parseAmazonSearch(amazonHtml), 2)).toHaveLength(2);
  });
});
