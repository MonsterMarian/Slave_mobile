// Převedeno z repa Slave: desktop-agent/scripts/vzorce.check.ts (stejné případy).
import { describe, expect, it } from "vitest";
import { adresa, formatuj, nazevSloupce, normalizuj, spocitej } from "./vzorce";

const f = (bunky: string[][]) => spocitej(bunky).map((r) => r.map(formatuj));

describe("vzorce", () => {
  it("názvy sloupců a adresy", () => {
    expect(nazevSloupce(0)).toBe("A");
    expect(nazevSloupce(25)).toBe("Z");
    expect(nazevSloupce(26)).toBe("AA");
    expect(adresa("$B$12")).toEqual([11, 1]);
    expect(adresa("A0")).toBeNull();
  });

  it("aritmetika a souhrnné funkce", () => {
    expect(f([["1", "2,5", "=A1+B1*2"], ["=SUM(A1:C1)", "=AVERAGE(A1:B1)", "=MAX(A1:C1;10)"]])).toEqual([
      ["1", "2,5", "6"],
      ["9,5", "1,75", "10"],
    ]);
  });

  it("cyklus a dělení nulou", () => {
    expect(f([["=A2", "=1/0", "=B1+1"], ["=A1"]])).toEqual([["#CYKLUS!", "#DĚLENÍ/0!", "#DĚLENÍ/0!"], ["#CYKLUS!"]]);
  });

  it("chyby hodnoty, názvu a syntaxe", () => {
    expect(f([["text", "=A1+1", "=FOO(1)", "=1+"]])).toEqual([["text", "#HODNOTA!", "#NÁZEV?", "#CHYBA!"]]);
  });

  it("IF, spojení, ROUND, COUNT", () => {
    expect(f([['=IF(A2>2,"velké","malé")', '=A2&" ks"', "=ROUND(2/3,2)", "=COUNT(A2:B2)"], ["3", "x"]])).toEqual([
      ["velké", "3 ks", "0,67", "1"],
      ["3", "x"],
    ]);
  });

  it("priorita operátorů a prázdné buňky", () => {
    expect(f([["=SUM(A2:A3)", "=-2^2", "=2+3*4", "=(2+3)*4"], [""], ["4"]])).toEqual([
      ["4", "4", "14", "20"],
      [""],
      ["4"],
    ]);
  });

  it("středník mimo řetězec se převede na čárku", () => {
    expect(normalizuj('=IF(A1;"a;b";2)')).toBe('=IF(A1,"a;b",2)');
  });
});
