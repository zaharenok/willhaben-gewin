import { describe, expect, it } from "vitest";
import {
  WIEN_RENT_MEDIAN_EUR_M2,
  bezirkFromAddress,
  bezirkFromHref,
  rentMedianForBezirk,
} from "../src/lib/bezirk-medians";

describe("bezirkFromHref", () => {
  it("reads the district from willhaben slugs (PLZ-encoded)", () => {
    expect(bezirkFromHref("/iad/immobilien/d/mietwohnungen/wien/wien-1140-penzing/x-123/")).toBe(14);
    expect(bezirkFromHref("/iad/immobilien/d/eigentumswohnung/wien/wien-1010-innere-stadt/x-1/")).toBe(1);
    expect(bezirkFromHref("/iad/immobilien/d/mietwohnungen/wien/wien-1230-liesing/x-9/")).toBe(23);
  });

  it("returns null when no Vienna district is in the path", () => {
    expect(bezirkFromHref("/iad/d/-111111/")).toBeNull();
    expect(bezirkFromHref(null)).toBeNull();
    expect(bezirkFromHref("/iad/immobilien/d/salzburg/salzburg-5020-x/")).toBeNull();
    expect(bezirkFromHref("/iad/immobilien/d/wien-9999-blabla/x/")).toBeNull();
  });
});

describe("bezirkFromAddress", () => {
  it("prefers the explicit district from the Objektstandort", () => {
    expect(bezirkFromAddress("1140 Wien, 14. Bezirk, Penzing")).toBe(14);
    expect(bezirkFromAddress("Aladar-Pecht-Gasse, 1220 Wien, 22. Bezirk, Donaustadt")).toBe(22);
  });

  it("falls back to the Vienna postal code", () => {
    expect(bezirkFromAddress("Mariahilfer Straße, 1150 Wien")).toBe(15);
  });

  it("returns null without Vienna evidence", () => {
    expect(bezirkFromAddress(null)).toBeNull();
    expect(bezirkFromAddress("Salzburg")).toBeNull();
    expect(bezirkFromAddress("5020 Salzburg")).toBeNull();
  });
});

describe("rent medians", () => {
  it("covers all 23 districts with plausible values", () => {
    expect(Object.keys(WIEN_RENT_MEDIAN_EUR_M2)).toHaveLength(23);
    for (let d = 1; d <= 23; d++) expect(rentMedianForBezirk(d)).toBeGreaterThan(10);
  });

  it("is null for unknown districts", () => {
    expect(rentMedianForBezirk(null)).toBeNull();
    expect(rentMedianForBezirk(99)).toBeNull();
  });
});
