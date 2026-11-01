import { describe, expect, it } from "vitest";
import { computeSavings, formatEur } from "../src/lib/savings";

describe("computeSavings", () => {
  it("computes the overpay in € and % (spec example: 35 vs 89)", () => {
    expect(computeSavings(35, 89)).toEqual({ diffEur: 54, pct: 154 });
  });

  it("rounds cents to 2dp and percent to integer", () => {
    expect(computeSavings(19.99, 24.99)).toEqual({ diffEur: 5, pct: 25 });
    expect(computeSavings(0.1, 0.3)).toEqual({ diffEur: 0.2, pct: 200 });
    expect(computeSavings(10, 10.5)).toEqual({ diffEur: 0.5, pct: 5 });
  });

  it("goes negative when used is cheaper than new", () => {
    expect(computeSavings(100, 80)).toEqual({ diffEur: -20, pct: -20 });
  });
});

describe("formatEur", () => {
  it("formats de-AT currency with € symbol", () => {
    const out = formatEur(54);
    expect(out).toContain("54");
    expect(out).toContain("€");
    expect(formatEur(1234.5)).toMatch(/1\.234[,.]50|1[  ]234[,.]50/);
  });
});
