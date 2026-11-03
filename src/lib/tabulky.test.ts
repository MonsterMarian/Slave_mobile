import { beforeEach, describe, expect, it } from "vitest";
import { mrizka, nactiTabulky, nastavBunku, novaTabulka, rozmer, TABULKY_KEY, ulozTabulky } from "./tabulky";
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
