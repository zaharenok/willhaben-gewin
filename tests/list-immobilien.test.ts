import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startImmobilienListAnnotations } from "../src/content/list-badge-immobilien";

const searchHtml = readFileSync(resolve(process.cwd(), "tests/fixtures/willhaben-immobilien-search.html"), "utf8");

afterEach(() => {
  document.body.innerHTML = "";
});

function loadSearchFixture(): void {
  // DOMParser drops the fixture's <script> tags; the annotator reads global document
  const doc = new DOMParser().parseFromString(searchHtml, "text/html");
  document.body.innerHTML = doc.body.innerHTML;
}

function pillOf(host: Element): Element {
  return host.shadowRoot!.querySelector(".pill")!;
}

describe("immobilien list pills", () => {
  it("colors rows against their Bezirk median (1090 loss, 1080 win)", () => {
    loadSearchFixture();
    const ctrl = startImmobilienListAnnotations();
    const hosts = [...document.querySelectorAll("[data-whg-row-badge]")];
    expect(hosts.length).toBeGreaterThan(3);
    const norm = (s: string | null): string => (s ?? "").replace(/\u00A0/g, " ");
    // 1. Bezirk Alsergrund: € 25,38/m² vs median € 22,68 → loss
    expect(norm(pillOf(hosts[0]).className)).toContain("loss");
    expect(norm(pillOf(hosts[0]).getAttribute("title"))).toContain("22,68");
    // 8. Bezirk Josefstadt: € 23,10/m² vs median € 23,21 → win
    expect(norm(pillOf(hosts[2]).className)).toContain("win");
    expect(norm(pillOf(hosts[2]).getAttribute("title"))).toContain("23,21");
    expect(norm(pillOf(hosts[0]).textContent)).toMatch(/€ \d+,\d{2}\/m²/);
    ctrl.stop();
    expect(document.querySelectorAll("[data-whg-row-badge]").length).toBe(0);
  });

  it("mounts no pill for rows without a €/m² (price on request)", () => {
    document.body.innerHTML =
      `<a data-testid="search-result-entry-header-111111" href="/iad/d/-111111/"><h3>Erste</h3>` +
      `<span data-testid="search-result-entry-price-111111">Preis auf Anfrage</span></a>` +
      `<a data-testid="search-result-entry-header-222222" href="/iad/d/-222222/"><h3>Zweite</h3>` +
      `<span data-testid="search-result-entry-price-222222">Preis auf Anfrage</span></a>`;
    const ctrl = startImmobilienListAnnotations();
    expect(document.querySelectorAll("[data-whg-row-badge]").length).toBe(0);
    ctrl.stop();
  });

  it("stays neutral below 3 comparable rows", () => {
    document.body.innerHTML =
      `<a data-testid="search-result-entry-header-111111" href="/iad/d/-111111/"><h3>Erste</h3>` +
      `<span data-testid="search-result-entry-price-per-sqmeter-111111">€ 10,00/m²</span></a>` +
      `<a data-testid="search-result-entry-header-222222" href="/iad/d/-222222/"><h3>Zweite</h3>` +
      `<span data-testid="search-result-entry-price-per-sqmeter-222222">€ 20,00/m²</span></a>`;
    const ctrl = startImmobilienListAnnotations();
    const kinds = [...document.querySelectorAll("[data-whg-row-badge]")].map((h) => pillOf(h).className);
    expect(kinds).toHaveLength(2);
    expect(kinds.every((c) => c.includes("unknown"))).toBe(true);
    ctrl.stop();
  });
});
