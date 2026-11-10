import { describe, expect, it } from "vitest";
import { ANNUITY_RATE_PCT, ANNUITY_YEARS, monthlyRate } from "../src/lib/financing";

describe("monthlyRate", () => {
  it("computes the annuity for the default 3.60 % / 20 y", () => {
    expect(ANNUITY_RATE_PCT).toBe(3.6);
    expect(ANNUITY_YEARS).toBe(20);
    // 359 600 € (Kauf fixture): 100 % financing → ~2 104 €/month, an upper bound
    const rate = monthlyRate(359_600);
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(2_095);
    expect(rate!).toBeLessThan(2_115);
  });

  it("is linear in the price", () => {
    const half = monthlyRate(200_000)!;
    expect(monthlyRate(400_000)!).toBeCloseTo(2 * half, 6);
  });

  it("returns null for missing or unusable inputs", () => {
    expect(monthlyRate(null)).toBeNull();
    expect(monthlyRate(0)).toBeNull();
    expect(monthlyRate(-100)).toBeNull();
    expect(monthlyRate(100_000, -1)).toBeNull();
    expect(monthlyRate(100_000, 3.6, 0)).toBeNull();
  });

  it("handles 0 % without dividing by zero", () => {
    expect(monthlyRate(240_000, 0, 20)).toBeCloseTo(1_000, 6);
  });
});
