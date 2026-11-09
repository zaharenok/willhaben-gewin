/**
 * Orientation-only rent-cap check under Vienna's Mietrechtsgesetz (MRG).
 *
 * Constants: Richtwertzins Wien = €6.74/m² since 1.4.2026
 * (source: mietenrechner.wien.gv.at), plus maximum Lage-/Zustandszuschläge
 * of ≈ €2.25/m² for a "brauchbar" flat → highest plausible net rent ≈ €8.99/m².
 *
 * The verdict is a display heuristic, never legal advice: the MRG's full
 * scope, individual surcharges and exemptions can only be checked by the
 * Schlichtungsstelle / a lawyer.
 */
export const RICHTWERT_EUR_M2 = 6.74;
export const MAX_ZUSCHLAG_EUR_M2 = 2.25;
/** Highest plausible net rent (base + maximum surcharges). */
export const RICHTWERT_CEILING_EUR_M2 = RICHTWERT_EUR_M2 + MAX_ZUSCHLAG_EUR_M2; // 8.99
/** MRG Vollanwendung: buildings completed before 1945. */
const MRG_VOLLANWENDUNG_BIS = 1945;

export type RichtwertVerdict = "plausibel" | "auffaellig" | "unklar";

export interface RichtwertInput {
  isRent: boolean;
  nettoMieteEur: number | null;
  wohnflaecheM2: number | null;
  bautyp: string | null;
  baujahr: number | null;
}

export interface RichtwertResult {
  verdict: RichtwertVerdict;
  /** Net rent per m² (exkl. BK/MWSt) when computable. */
  nettoPerM2: number | null;
  /** nettoPerM2 / RICHTWERT — 1.78 = 78 % above the base cap. */
  ratio: number | null;
}

export function checkRichtwert(input: RichtwertInput): RichtwertResult {
  const nettoPerM2 =
    input.isRent &&
    input.nettoMieteEur !== null &&
    input.wohnflaecheM2 !== null &&
    input.wohnflaecheM2 > 0
      ? input.nettoMieteEur / input.wohnflaecheM2
      : null;
  const ratio = nettoPerM2 !== null ? nettoPerM2 / RICHTWERT_EUR_M2 : null;
  if (nettoPerM2 === null || ratio === null) {
    return { verdict: "unklar", nettoPerM2: null, ratio: null };
  }

  // MRG only fully applies to pre-1945 buildings. An explicit Baujahr wins
  // over the Bautyp label; without either, the cap is not checkable.
  const prewar = input.baujahr !== null ? input.baujahr < MRG_VOLLANWENDUNG_BIS : null;
  const altbauLabel = input.bautyp !== null && /altbau/i.test(input.bautyp);
  const neubauLabel = input.bautyp !== null && /neubau/i.test(input.bautyp);
  const mrgApplies = prewar !== null ? prewar : neubauLabel ? false : altbauLabel;
  if (!mrgApplies) return { verdict: "unklar", nettoPerM2, ratio };

  return {
    verdict: nettoPerM2 <= RICHTWERT_CEILING_EUR_M2 ? "plausibel" : "auffaellig",
    nettoPerM2,
    ratio,
  };
}
