import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractListing } from "../src/lib/extract-willhaben";
import { rankCandidates, relevance, scoreMatch, searchQueryFor } from "../src/lib/match";
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

describe("searchQueryFor", () => {
  it("drops condition words and specs overflow, keeps brand+model first", () => {
    expect(searchQueryFor("Apple Mac Studio M4 Max 128 GB RAM - 2 TB SSD"))
      .toBe("apple mac studio m4 max 128 gb ram");
    expect(searchQueryFor("Samsung Pro 990 M.2 SSD 2TB Neu und versiegelt"))
      .not.toContain("neu");
  });
});

describe("relevance", () => {
  it("vetoes mismatched RAM capacity (128 GB vs 36 GB)", () => {
    expect(relevance("Apple Mac Studio M4 Max 128 GB RAM - 2 TB SSD", "Apple Mac Studio mit Apple M5 Max Chip, 36 GB")).toBe(0);
    expect(relevance("Apple Mac Studio M4 Max 128 GB RAM - 2 TB SSD", "Apple Mac Studio mit Apple M5 Max Chip - Silber")).toBe(0);
  });
  it("vetoes different product lines (Mac Studio vs MacBook Pro)", () => {
    expect(relevance("Apple Mac Studio M1 Max - 32 GB RAM / 1 TB SSD", "Apple MacBook Pro 2021, Apple M1 Max Chip mit (16 Zoll, 32 GB RAM, 1 TB SSD)")).toBe(0);
  });
  it("keeps same line (Mac Studio vs Mac Studio)", () => {
    expect(relevance("Apple Mac Studio M1 Max 32 GB", "Apple Mac Studio mit M1 Max Chip, 32 GB")).toBeGreaterThan(0.5);
  });
  it("vetoes accessories that merely fit the product", () => {
    expect(relevance("Macbook Air M4 2025", "Fintie Hülle Kompatibel mit MacBook Air 13,6 Zoll M5 M4 M3 M2, Transparent")).toBe(0);
  });
  it("vetoes stands/hubs that merely fit the product (Satechi vs Mac Studio)", () => {
    expect(relevance("Apple Mac Studio M1 Max - 32 GB RAM / 1 TB SSD", "Satechi Stand&Hub für Mac Mini / Studio Silber")).toBe(0);
    // Same veto without a capacity on either side — isolates the `stand` word.
    expect(relevance("Apple Mac Studio M1 Max", "Satechi Stand&Hub für Mac Mini / Studio Silber")).toBe(0);
  });
  it("keeps accessory listings when the listing IS the accessory", () => {
    expect(relevance("Hülle für MacBook Air M4", "Fintie Hülle Kompatibel mit MacBook Air M4")).toBeGreaterThan(0.3);
  });
  it("vetoes different brands (Apple Mac Studio vs HP laptop)", () => {
    expect(relevance("Apple Mac Studio M1 Max - 32 GB RAM / 1 TB SSD", "HP 17 Business Laptop, AMD Ryzen 7 7730U, 32 GB DDR4 RAM, 1 TB SSD, 17,3 Zoll")).toBe(0);
  });
  it("compares across generations when capacity matches", () => {
    expect(relevance("Apple Mac Studio M4 Max 128 GB RAM", "Apple Mac Studio mit Apple M5 Max Chip, 128 GB")).toBeGreaterThan(0.5);
  });
  it("ignores veto when either side lacks a GB capacity", () => {
    expect(relevance("iPhone 13 128GB Mitternacht", "Apple iPhone 13, 128GB, Mitternacht")).toBeGreaterThan(0.9);
  });
  it("vetoes mismatched SSD capacity across units (2 TB listing vs 1 TB candidate)", () => {
    expect(relevance("Kingston 2 TB SSD NVMe M.2", "Kingston NV2 1TB M.2 2280 NVMe internes SSD")).toBe(0);
  });
  it("accepts equal capacity across units (2 TB listing vs 2048 GB candidate)", () => {
    expect(relevance("Kingston 2 TB SSD NVMe M.2", "Kingston NV3 2048GB M.2 2280 NVMe internes SSD")).toBeGreaterThan(0.3);
  });
  it("accepts a matching 2 TB candidate", () => {
    expect(relevance("Kingston 2 TB SSD NVMe M.2", "Kingston NV3 2TB M.2 2280 NVMe internes SSD")).toBeGreaterThan(0.3);
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
