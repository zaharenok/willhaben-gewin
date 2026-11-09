import { describe, expect, it } from "vitest";
import {
  checkRichtwert,
  RICHTWERT_CEILING_EUR_M2,
  RICHTWERT_EUR_M2,
} from "../src/lib/richtwert";

/** The live fixture listing: 131 m², €1572 netto → €11.99/m². */
const rent = {
  isRent: true,
  nettoMieteEur: 1572,
  wohnflaecheM2: 131,
  bautyp: "Altbau",
  baujahr: null,
};

describe("checkRichtwert", () => {
  it("flags the fixture rent (€11.99/m²) as well above the cap", () => {
    const r = checkRichtwert(rent);
    expect(r.nettoPerM2).toBeCloseTo(11.999, 2);
    expect(r.ratio).toBeCloseTo(11.999 / RICHTWERT_EUR_M2, 2);
    expect(r.verdict).toBe("auffaellig");
  });

  it("accepts rents within Richtwert + max Zuschläge", () => {
    // 917 / 131 = €7.00/m²
    expect(checkRichtwert({ ...rent, nettoMieteEur: 917 }).verdict).toBe("plausibel");
  });

  it("uses the ceiling (Richtwert + €2.25) as the verdict boundary", () => {
    const area = 100;
    expect(
      checkRichtwert({ ...rent, nettoMieteEur: RICHTWERT_CEILING_EUR_M2 * area, wohnflaecheM2: area }).verdict,
    ).toBe("plausibel");
    expect(
      checkRichtwert({ ...rent, nettoMieteEur: RICHTWERT_CEILING_EUR_M2 * area + 0.01, wohnflaecheM2: area }).verdict,
    ).toBe("auffaellig");
  });

  it("stays unklar for post-1945 buildings and Neubau", () => {
    expect(checkRichtwert({ ...rent, baujahr: 1950 }).verdict).toBe("unklar");
    expect(checkRichtwert({ ...rent, bautyp: "Neubau" }).verdict).toBe("unklar");
  });

  it("trusts the Baujahr over a conflicting Bautyp label", () => {
    const r = checkRichtwert({ ...rent, baujahr: 1905, bautyp: "Neubau" });
    expect(r.verdict).not.toBe("unklar");
    expect(r.verdict).toBe("auffaellig");
  });

  it("is unklar without prewar evidence", () => {
    expect(checkRichtwert({ ...rent, bautyp: null, baujahr: null }).verdict).toBe("unklar");
  });

  it("is unklar without net rent, area, or on purchase listings", () => {
    expect(checkRichtwert({ ...rent, nettoMieteEur: null }).verdict).toBe("unklar");
    expect(checkRichtwert({ ...rent, wohnflaecheM2: null }).verdict).toBe("unklar");
    expect(checkRichtwert({ ...rent, isRent: false }).verdict).toBe("unklar");
  });
});
