import { describe, expect, it } from "vitest";
import { akcentCss, kontrast, PALETY, POVRCHY, VYCHOZI_AKCENT } from "./barvy";

const HEX = /^#[0-9A-F]{6}$/i;

describe("kontrast WCAG", () => {
  it("známé hodnoty", () => {
    expect(kontrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(kontrast("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(kontrast("#0866FF", "#FFFFFF")).toBeCloseTo(4.8, 1);
    expect(kontrast("#38BDF8", "#09090B")).toBeCloseTo(9.3, 1);
  });
});

describe("palety", () => {
  it("výchozí sky existuje, id jsou unikátní", () => {
    expect(PALETY.some((p) => p.id === VYCHOZI_AKCENT)).toBe(true);
    expect(new Set(PALETY.map((p) => p.id)).size).toBe(PALETY.length);
  });

  it.each(PALETY)("$id: obě varianty, text na akcentu, kontrast ≥ 4,5", (p) => {
    for (const rezim of ["tmava", "svetla"] as const) {
      const v = p[rezim];
      expect(v.akcent).toMatch(HEX);
      expect(v.text).toMatch(HEX);
      for (const povrch of POVRCHY[rezim]) expect(kontrast(v.akcent, povrch)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(v.text, v.akcent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("CSS má pravidlo pro každou paletu v obou režimech", () => {
    const css = akcentCss();
    for (const p of PALETY) {
      expect(css).toContain(`html[data-accent="${p.id}"]{--brand:${p.svetla.akcent}`);
      expect(css).toContain(`html.dark[data-accent="${p.id}"]{--brand:${p.tmava.akcent}`);
    }
  });
});
