import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AKCENT, kontrast, POVRCHY } from "./barvy";

describe("kontrast WCAG", () => {
  it("známé hodnoty", () => {
    expect(kontrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(kontrast("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(kontrast("#0866FF", "#FFFFFF")).toBeCloseTo(4.8, 1);
  });
});

describe("akcent S/_ave modrá", () => {
  it.each(["tmava", "svetla"] as const)("%s: kontrast ≥ 4,5 na pozadí, kartě i pro text na tlačítku", (rezim) => {
    const v = AKCENT[rezim];
    for (const povrch of POVRCHY[rezim]) expect(kontrast(v.akcent, povrch)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(v.text, v.akcent)).toBeGreaterThanOrEqual(4.5);
  });

  it("globals.css používá tytéž hodnoty", () => {
    const css = readFileSync("src/app/globals.css", "utf8").toLowerCase();
    const svetly = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
    const tmavy = css.slice(css.indexOf(".dark {"), css.indexOf("@theme"));
    expect(svetly).toContain(`--brand: ${AKCENT.svetla.akcent.toLowerCase()};`);
    expect(svetly).toContain(`--brand-foreground: ${AKCENT.svetla.text.toLowerCase()};`);
    expect(tmavy).toContain(`--brand: ${AKCENT.tmava.akcent.toLowerCase()};`);
    expect(tmavy).toContain(`--brand-foreground: ${AKCENT.tmava.text.toLowerCase()};`);
  });
});
