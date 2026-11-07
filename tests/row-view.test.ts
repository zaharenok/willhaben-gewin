import { describe, expect, it } from "vitest";
import { rowBadge } from "../src/lib/row-view";

/** de-AT Intl formats with a no-break space after "€" — normalize for asserts. */
function nbsp(s: string): string {
  return s.replace(/\u00A0/g, " ");
}

describe("rowBadge", () => {
  it("win: listing undercuts the median new price", () => {
    const badge = rowBadge({ min: 380, median: 429.65 }, 380)!;
    expect(badge.kind).toBe("win");
    expect(nbsp(badge.text)).toBe("−€ 49,65 (−13%)");
  });

  it("loss: listing above the median new price", () => {
    const badge = rowBadge({ min: 429.65, median: 429.65 }, 500)!;
    expect(badge.kind).toBe("loss");
    expect(nbsp(badge.text)).toBe("+€ 70,35 (+14%)");
  });

  it("falls back to the cheapest candidate when no median exists", () => {
    const badge = rowBadge({ min: 100, median: null }, 90)!;
    expect(badge.kind).toBe("win");
    expect(nbsp(badge.text)).toBe("−€ 10,00 (−11%)");
  });

  it("unknown: no listing price but a new-price range exists", () => {
    const badge = rowBadge({ min: 380, median: 429.65 }, null)!;
    expect(badge.kind).toBe("unknown");
    expect(nbsp(badge.text)).toBe("≈ € 429,65");
  });

  it("returns null when neither side has a price", () => {
    expect(rowBadge({ min: null, median: null }, null)).toBeNull();
    expect(rowBadge({ min: null, median: null }, 380)).toBeNull();
  });

  it("tooltip carries the min–median range", () => {
    const badge = rowBadge({ min: 380, median: 429.65 }, 380)!;
    expect(nbsp(badge.tooltip)).toContain("€ 380,00");
    expect(nbsp(badge.tooltip)).toContain("€ 429,65");
  });
});
