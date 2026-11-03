// Převedeno z repa Slave: desktop-agent/scripts/vzorce.check.ts (stejné případy).
import { describe, expect, it } from "vitest";
import { adresa, formatuj, napoveda, nazevSloupce, normalizuj, spocitej } from "./vzorce";

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

  // Kontakty: A jméno, B status, C částka
  const KONTAKTY = [
    ["Jan Novák", "nový", "100"],
    ["Eva Malá", "hotovo", "250"],
    ["Petr Velký", "nový", "50"],
    ["Jana Nová", "", "x"],
  ];
  const s = (vzorec: string) => f([...KONTAKTY, [vzorec]])[4][0];

  it("SUMIF / COUNTIF / AVERAGEIF a vícenásobné podmínky", () => {
    expect(s('=SUMIF(B1:B4;"nový";C1:C4)')).toBe("150");
    expect(s("=SUMIF(C1:C4;\">60\")")).toBe("350");
    expect(s('=COUNTIF(A1:A4;"Jan*")')).toBe("2");
    expect(s('=COUNTIF(B1:B4;"<>nový")')).toBe("2");
    expect(s('=COUNTIF(B1:B4;"")')).toBe("1");
    expect(s('=AVERAGEIF(B1:B4;"nový";C1:C4)')).toBe("75");
    expect(s('=COUNTIFS(B1:B4;"nový";C1:C4;">60")')).toBe("1");
    expect(s('=SUMIFS(C1:C4;B1:B4;"nový";A1:A4;"P*")')).toBe("50");
    expect(s("=COUNTBLANK(B1:B4)")).toBe("1");
  });

  it("vyhledávání: VLOOKUP, XLOOKUP, INDEX + MATCH", () => {
    expect(s('=VLOOKUP("Eva Malá";A1:C4;3;FALSE)')).toBe("250");
    expect(s('=VLOOKUP("nikdo";A1:C4;2;0)')).toBe("#NENÍ_K_DISPOZICI");
    expect(s('=XLOOKUP("Petr Velký";A1:A4;B1:B4)')).toBe("nový");
    expect(s('=XLOOKUP("nikdo";A1:A4;B1:B4;"?")')).toBe("?");
    expect(s('=INDEX(A1:C4;MATCH("Eva Malá";A1:A4;0);3)')).toBe("250");
    expect(s("=INDEX(A1:C1;2)")).toBe("nový");
    expect(f([["1", "10"], ["5", "50"], ["9", "90"], ["=VLOOKUP(6;A1:B3;2)"]])[3][0]).toBe("50"); // přibližně
  });

  it("IFERROR, IFS, CHOOSE a chyba jako hodnota v argumentu", () => {
    expect(s("=IFERROR(1/0;\"nejde\")")).toBe("nejde");
    expect(s("=IFERROR(C4*2+1;0)")).toBe("0");
    expect(s("=IF(TRUE;1;1/0)")).toBe("1");
    expect(s("=ISERROR(VLOOKUP(\"x\";A1:C4;2;0))")).toBe("TRUE");
    expect(s('=IFS(C1>200;"hodně";C1>50;"středně";TRUE;"málo")')).toBe("středně");
    expect(s('=CHOOSE(2;"a";"b";"c")')).toBe("b");
    expect(s("=SUM(1/0;1)")).toBe("#DĚLENÍ/0!");
    expect(s("=IFERROR(1+;0)")).toBe("#CHYBA!");
  });

  it("text", () => {
    expect(s('=UPPER("žluť")&LOWER("ÁB")&PROPER("jan novák")')).toBe("ŽLUŤábJan Novák");
    expect(s('=LEFT("Praha";2)&RIGHT("Praha";2)&MID("Praha";2;3)')).toBe("Prharah");
    expect(s('=TRIM("  a   b ")')).toBe("a b");
    expect(s('=FIND("a";"Praha")&SEARCH("P";"praha")')).toBe("31");
    expect(s('=SUBSTITUTE("a-b-c";"-";"+")&SUBSTITUTE("a-b-c";"-";"+";2)')).toBe("a+b+ca-b+c");
    expect(s('=TEXTJOIN(", ";TRUE;A1:A2;B4)')).toBe("Jan Novák, Eva Malá");
    expect(s('=CONCATENATE("a";1;"b")&REPT("x";3)&EXACT("A";"a")')).toBe("a1bxxxFALSE");
    expect(s('=VALUE("12,5")+LEN("abc")')).toBe("15,5");
  });

  it("čísla", () => {
    expect(s("=PRODUCT(2;3;4)&\"|\"&MEDIAN(C1:C3)&\"|\"&LARGE(C1:C3;1)&\"|\"&SMALL(C1:C3;1)")).toBe("24|100|250|50");
    // ve vzorci desetinná tečka (čárka odděluje argumenty); v buňce jde i čárka
    expect(s("=ROUNDUP(2.341;2)&\"|\"&ROUNDDOWN(-2.349;2)&\"|\"&INT(-1.5)&\"|\"&MOD(-7;3)")).toBe("2,35|-2,34|-2|2");
    expect(s("=SQRT(16)+POWER(2;3)+ROUND(PI();2)")).toBe("15,14");
    expect(s("=SQRT(-1)")).toBe("#ČÍSLO!");
    expect(s("=SUMPRODUCT(C1:C3;C1:C3)")).toBe("75000");
    expect(s("=_xlfn.CONCAT(\"a\";\"b\")")).toBe("ab");
  });

  it("nápověda funkcí při psaní vzorce", () => {
    expect(napoveda("=su").funkce.slice(0, 3)).toEqual(["SUM", "SUMIF", "SUMIFS"]);
    expect(napoveda("=A1+vl")).toEqual({ slovo: "vl", funkce: ["VLOOKUP"] });
    expect(napoveda("=A1").funkce).toEqual([]); // odkaz, ne funkce
    expect(napoveda('=IF(A1="su').funkce).toEqual([]); // v řetězci
    expect(napoveda("su").funkce).toEqual([]); // není vzorec
    expect(napoveda("=SUM").funkce).toEqual(["SUMIF", "SUMIFS", "SUMPRODUCT"]);
  });

  it("středník mimo řetězec se převede na čárku", () => {
    expect(normalizuj('=IF(A1;"a;b";2)')).toBe('=IF(A1,"a;b",2)');
  });
});
