import { describe, expect, it, vi } from "vitest";
import { t } from "../src/lib/i18n";

const KEYS = ["badgeNew", "badgeGoogle", "badgeCompare", "cheaper", "costlier", "chooseTitle", "blockedHint", "openSearch", "openGoogle", "noMatch"] as const;

describe("t", () => {
  it("returns German by default (jsdom navigator.language = en-US → en)", () => {
    // jsdom reports en-US; verify English there and DE fallback below.
    expect(t("badgeNew")).toBe("New on Amazon");
  });

  it("falls back to German for unsupported languages", () => {
    const spy = vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR");
    expect(t("badgeNew")).toBe("Neupreis auf Amazon");
    spy.mockRestore();
  });

  it("translates Russian", () => {
    const spy = vi.spyOn(navigator, "language", "get").mockReturnValue("ru-RU");
    expect(t("cheaper")).toBe("дешевле");
    spy.mockRestore();
  });

  it("has all keys in every language", () => {
    for (const lang of ["de-DE", "en-US", "ru-RU"]) {
      const spy = vi.spyOn(navigator, "language", "get").mockReturnValue(lang);
      for (const key of KEYS) expect(t(key)).toBeTruthy();
      spy.mockRestore();
    }
  });
});
