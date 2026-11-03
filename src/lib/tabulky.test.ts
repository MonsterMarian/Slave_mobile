import { beforeEach, describe, expect, it } from "vitest";
import { mrizka, nactiTabulky, nastavBunku, nastavSirku, novaTabulka, platna, rozmer, sirkaPodleTextu, SIRKA_AUTO_MAX, SIRKA_MAX, SIRKA_MIN, TABULKY_KEY, ulozTabulky } from "./tabulky";
import { falesneUloziste } from "./test-uloziste";
import { formatuj, spocitej } from "./vzorce";

describe("list tabulky", () => {
  it("výchozí 50 × 10, roste podle obsahu, strop 1000 × 100", () => {
    let l = novaTabulka("T").listy[0];
    expect(rozmer(l)).toEqual({ radky: 50, sloupce: 10 });
    l = nastavBunku(l, 49, 9, "x");
    expect(rozmer(l)).toEqual({ radky: 60, sloupce: 12 });
    l = nastavBunku(l, 999, 99, "x");
    expect(rozmer(l)).toEqual({ radky: 1000, sloupce: 100 });
  });

  it("prázdná hodnota buňku smaže, mřížka jde do vzorců", () => {
    let l = novaTabulka("T").listy[0];
    l = nastavBunku(l, 0, 0, "1");
    l = nastavBunku(l, 1, 0, "2");
    l = nastavBunku(l, 2, 0, "=SUM(A1:A2)");
    l = nastavBunku(l, 0, 1, "y");
    l = nastavBunku(l, 0, 1, "");
    expect(Object.keys(l.bunky)).toHaveLength(3);
    expect(spocitej(mrizka(l)).map((r) => r.map(formatuj))).toEqual([["1"], ["2"], ["3"]]);
  });
});

describe("úložiště tabulek", () => {
  let m: Map<string, string>;
  beforeEach(() => {
    m = falesneUloziste();
  });

  it("uložit a načíst", () => {
    const t = novaTabulka("Rozpočet");
    t.listy[0] = nastavBunku(t.listy[0], 3, 0, "=A1/0");
    expect(ulozTabulky([t])).toBe(true);
    expect(nactiTabulky()).toEqual([t]);
  });

  it("poškozená data appku neshodí", () => {
    m.set(TABULKY_KEY, "[{");
    expect(nactiTabulky()).toEqual([]);
    m.set(TABULKY_KEY, JSON.stringify({ ne: "pole" }));
    expect(nactiTabulky()).toEqual([]);
  });

  it("vadné buňky a listy vypadnou, tabulka bez listu dostane prázdný", () => {
    m.set(
      TABULKY_KEY,
      JSON.stringify([
        { id: "a", nazev: "A", listy: [{ id: "l", nazev: "L", bunky: { "0,0": "1", x: "2", "0,1": 3, "5000,0": "v" } }] },
        { id: "b", nazev: "B", listy: "nesmysl" },
        { nazev: "bez id" },
      ]),
    );
    const t = nactiTabulky();
    expect(t.map((x) => x.nazev)).toEqual(["A", "B"]);
    expect(t[0].listy[0].bunky).toEqual({ "0,0": "1" });
    expect(t[1].listy).toHaveLength(1);
  });
});

describe("šířky sloupců", () => {
  const mer = (t: string) => t.length * 8;

  it("podle textu: nejdelší text + okraj, prázdný sloupec výchozí, strop pro dlouhý text", () => {
    expect(sirkaPodleTextu(["id", "telefonní číslo", ""], mer)).toBe(15 * 8 + 14);
    expect(sirkaPodleTextu(["", ""], mer)).toBe(84);
    expect(sirkaPodleTextu(["a"], mer)).toBe(SIRKA_MIN);
    expect(sirkaPodleTextu(["x".repeat(200)], mer)).toBe(SIRKA_AUTO_MAX);
  });

  it("ruční šířka se omezí, null vrátí sloupec na šířku podle textu", () => {
    let l = novaTabulka("T").listy[0];
    l = nastavSirku(l, 2, 5000);
    expect(l.sirky).toEqual({ 2: SIRKA_MAX });
    l = nastavSirku(l, 2, null);
    expect("sirky" in l).toBe(false);
  });

  it("načtení: šířky přežijí, nesmysly vypadnou, bez šířek žádný klíč (kvůli porovnání při synchronizaci)", () => {
    const t = platna({ id: "t", nazev: "T", listy: [{ id: "l", nazev: "L", bunky: {}, sirky: { 0: 120, x: 5, 1: "široký", 200: 50 } }] })!;
    expect(t.listy[0].sirky).toEqual({ 0: 120 });
    const bez = platna({ id: "t", nazev: "T", listy: [{ id: "l", nazev: "L", bunky: {} }] })!;
    expect("sirky" in bez.listy[0]).toBe(false);
  });
});
