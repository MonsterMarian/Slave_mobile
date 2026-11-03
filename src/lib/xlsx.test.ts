import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { crc32, listXml, nazevSouboru, nazvyListu, xlsx, zip } from "./xlsx";
import type { Tabulka } from "./tabulky";

const TABULKA: Tabulka = {
  id: "t",
  nazev: "Rozpočet",
  upraveno: 0,
  listy: [
    { id: "a", nazev: "Leden", bunky: { "0,0": "Položka", "0,1": "Kč", "1,0": "Nájem & <voda>", "1,1": "12500,5", "2,1": "=SUM(B2;B2)" } },
    { id: "b", nazev: "leden", bunky: { "4,2": '=IF(1;"a;b";2)' } },
  ],
};

describe("xlsx", () => {
  it("crc32 podle normy", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("zip: hlavičky, adresář a konec sedí na sebe", () => {
    const z = zip([{ cesta: "a.txt", data: new TextEncoder().encode("ahoj") }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const konec = z.length - 22;
    expect(v.getUint32(konec, true)).toBe(0x06054b50);
    expect(v.getUint16(konec + 10, true)).toBe(1);
    expect(v.getUint32(v.getUint32(konec + 16, true), true)).toBe(0x02014b50);
  });

  it("buňky: čísla s čárkou, text escapovaný, vzorec s , místo ;", () => {
    const x = listXml(TABULKA.listy[0]);
    expect(x).toContain('<c r="B2"><v>12500.5</v></c>');
    expect(x).toContain("Nájem &amp; &lt;voda&gt;");
    expect(x).toContain('<c r="B3"><f>SUM(B2,B2)</f></c>');
    expect(listXml(TABULKA.listy[1])).toContain('<c r="C5"><f>IF(1,&quot;a;b&quot;,2)</f></c>');
  });

  it("jména listů a souboru podle pravidel Excelu / Androidu", () => {
    expect(nazvyListu(["Leden", "leden", "a/b?", ""])).toEqual(["Leden", "leden_2", "a_b_", "List4"]);
    expect(nazvyListu(["x".repeat(40), "x".repeat(40)]).map((n) => n.length)).toEqual([31, 31]);
    expect(nazevSouboru('Rozpočet: "2026"')).toBe("Rozpočet_ _2026_.xlsx");
  });

  it("celý sešit (XLSX_VYSTUP=cesta → zapíše soubor pro kontrolu v openpyxl)", () => {
    const data = xlsx(TABULKA);
    expect(new DataView(data.buffer).getUint32(0, true)).toBe(0x04034b50);
    if (process.env.XLSX_VYSTUP) writeFileSync(process.env.XLSX_VYSTUP, data);
  });
});
