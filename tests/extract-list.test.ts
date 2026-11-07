import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractRows, listRowId, SELECTORS_LIST } from "../src/lib/extract-list";

const fixtureHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-list.html"), "utf8");

describe("extractRows on a live willhaben list-page fixture", () => {
  const doc = new DOMParser().parseFromString(fixtureHtml, "text/html");
  const rows = extractRows(doc);

  it("finds the rendered result cards", () => {
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it("extracts title, price and numeric id per row", () => {
    const first = rows.find((r) => r.id === "1239126506");
    expect(first).toBeDefined();
    expect(first!.title).toBe("Iphone 16 pro mit 256 GB");
    expect(first!.priceEur).toBe(599);
    expect(rows.every((r) => /^\d{6,}$/.test(r.id))).toBe(true);
  });

  it("dedupes by listing id", () => {
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every row keeps a reference to its card anchor", () => {
    for (const row of rows) {
      expect(row.anchor.matches(SELECTORS_LIST.card)).toBe(true);
    }
  });
});

describe("extractRows edge cases (synthetic markup)", () => {
  it("keeps one row per id, drops titleless cards, tolerates missing prices", () => {
    const doc = new DOMParser().parseFromString(
      [
        '<a data-testid="search-result-entry-header-111111" href="/iad/kaufen-und-verkaufen/d/foo-111111/"><h3>Alpha</h3><span data-testid="search-result-entry-price-111111" aria-label="€ 10">10 €</span></a>',
        '<a data-testid="search-result-entry-header-111111" href="/iad/kaufen-und-verkaufen/d/foo-111111/"><h3>Alpha duplicate</h3></a>',
        '<a data-testid="search-result-entry-header-222222" href="/iad/kaufen-und-verkaufen/d/bar-222222/"><span>kein Titel</span></a>',
        '<a data-testid="search-result-entry-header-333333" href="/iad/kaufen-und-verkaufen/d/baz-333333/"><h3>Gamma</h3><span data-testid="search-result-entry-price-333333">Verhandlungsbasis</span></a>',
      ].join(""),
      "text/html",
    );
    const rows = extractRows(doc);
    expect(rows.map((r) => r.id)).toEqual(["111111", "333333"]);
    expect(rows[0].priceEur).toBe(10);
    expect(rows[1].priceEur).toBeNull();
    expect(rows[1].title).toBe("Gamma");
  });

  it("falls back to the href slug when the testid suffix is not a bare id", () => {
    const doc = new DOMParser().parseFromString(
      '<a data-testid="search-result-entry-header-v2-444444" href="/iad/kaufen-und-verkaufen/d/qux-444444/"><h3>Delta</h3></a>',
      "text/html",
    );
    const card = doc.querySelector("a")!;
    expect(card.matches(SELECTORS_LIST.card)).toBe(true);
    expect(listRowId(card)).toBe("444444");
  });
});
