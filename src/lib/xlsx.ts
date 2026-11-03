/**
 * Export tabulky do .xlsx bez knihovny: .xlsx je zip s pár XML soubory.
 * Zip je nekomprimovaný (STORE) - tabulky z telefonu jsou malé, Excel i openpyxl ho otevřou.
 * Ukládají se hodnoty a vzorce (Excel je při otevření přepočítá), ne formátování - stejně jako na PC.
 *
 * shortcut: bez komprese a bez stylů - přidat, kdyby soubory byly velké nebo bylo potřeba formátování.
 */
import { normalizuj, nazevSloupce } from "./vzorce";
import type { List, Tabulka } from "./tabulky";

const enc = new TextEncoder();

// ---------------------------------------------------------------- zip (STORE)

const CRC_TABULKA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABULKA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(soubory: { cesta: string; data: Uint8Array }[]): Uint8Array {
  const casti: Uint8Array[] = [];
  const adresar: Uint8Array[] = [];
  let posun = 0;
  for (const { cesta, data } of soubory) {
    const jmeno = enc.encode(cesta);
    const crc = crc32(data);
    // společná část místní hlavičky a záznamu v adresáři: verze, příznaky (bit 11 = UTF-8), metoda 0, čas, crc, velikosti
    const spolecne = (v: DataView, o: number) => {
      v.setUint16(o, 20, true);
      v.setUint16(o + 2, 0x0800, true);
      v.setUint16(o + 4, 0, true);
      v.setUint32(o + 6, 0x00210000, true); // 1. 1. 1980 00:00
      v.setUint32(o + 10, crc, true);
      v.setUint32(o + 14, data.length, true);
      v.setUint32(o + 18, data.length, true);
      v.setUint16(o + 22, jmeno.length, true);
    };
    const mistni = new Uint8Array(30 + jmeno.length);
    const mv = new DataView(mistni.buffer);
    mv.setUint32(0, 0x04034b50, true);
    spolecne(mv, 4);
    mistni.set(jmeno, 30);

    const zaznam = new Uint8Array(46 + jmeno.length);
    const zv = new DataView(zaznam.buffer);
    zv.setUint32(0, 0x02014b50, true);
    zv.setUint16(4, 20, true);
    spolecne(zv, 6);
    zv.setUint32(42, posun, true);
    zaznam.set(jmeno, 46);

    casti.push(mistni, data);
    adresar.push(zaznam);
    posun += mistni.length + data.length;
  }
  const velikostAdresare = adresar.reduce((s, a) => s + a.length, 0);
  const konec = new Uint8Array(22);
  const kv = new DataView(konec.buffer);
  kv.setUint32(0, 0x06054b50, true);
  kv.setUint16(8, soubory.length, true);
  kv.setUint16(10, soubory.length, true);
  kv.setUint32(12, velikostAdresare, true);
  kv.setUint32(16, posun, true);
  const vse = [...casti, ...adresar, konec];
  const out = new Uint8Array(vse.reduce((s, a) => s + a.length, 0));
  let o = 0;
  for (const a of vse) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

// ---------------------------------------------------------------- xml

function xml(text: string): string {
  // řídicí znaky (kromě tab/LF/CR) XML nesnese - Excel by soubor odmítl
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Stejné pravidlo jako `spocitej`: číslo i s desetinnou čárkou, jinak text. */
function cislo(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function bunkaXml(ref: string, raw: string): string {
  if (raw.startsWith("=") && raw.length > 1) return `<c r="${ref}"><f>${xml(normalizuj(raw).slice(1))}</f></c>`;
  const n = cislo(raw);
  if (n !== null) return `<c r="${ref}"><v>${n}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(raw)}</t></is></c>`;
}

export function listXml(list: List): string {
  const radky = new Map<number, [number, string][]>();
  for (const [k, v] of Object.entries(list.bunky)) {
    const [r, c] = k.split(",").map(Number);
    if (!radky.has(r)) radky.set(r, []);
    radky.get(r)!.push([c, v]);
  }
  const telo = [...radky.keys()]
    .sort((a, b) => a - b)
    .map((r) => {
      const bunky = radky
        .get(r)!
        .sort((a, b) => a[0] - b[0])
        .map(([c, v]) => bunkaXml(`${nazevSloupce(c)}${r + 1}`, v))
        .join("");
      return `<row r="${r + 1}">${bunky}</row>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${telo}</sheetData></worksheet>`
  );
}

/** Excel: jméno listu max 31 znaků, bez []:*?/\ a jedinečné (bez ohledu na velikost písmen). */
export function nazvyListu(nazvy: string[]): string[] {
  const pouzite = new Set<string>();
  return nazvy.map((n, i) => {
    const zaklad = n.replace(/[[\]:*?/\\]/g, "_").replace(/^'+|'+$/g, "").trim().slice(0, 31) || `List${i + 1}`;
    let jmeno = zaklad;
    for (let k = 2; pouzite.has(jmeno.toLowerCase()); k++) jmeno = `${zaklad.slice(0, 31 - String(k).length - 1)}_${k}`;
    pouzite.add(jmeno.toLowerCase());
    return jmeno;
  });
}

/** Bajty souboru .xlsx pro celou tabulku (všechny listy). */
export function xlsx(tabulka: Tabulka): Uint8Array {
  const jmena = nazvyListu(tabulka.listy.map((l) => l.nazev));
  const listy = tabulka.listy.map((l, i) => ({ cesta: `xl/worksheets/sheet${i + 1}.xml`, xml: listXml(l), jmeno: jmena[i] }));
  const hlavicka = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
  const ns = "http://schemas.openxmlformats.org";
  const soubory: [string, string][] = [
    [
      "[Content_Types].xml",
      `${hlavicka}<Types xmlns="${ns}/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        listy
          .map((l) => `<Override PartName="/${l.cesta}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("") +
        `</Types>`,
    ],
    [
      "_rels/.rels",
      `${hlavicka}<Relationships xmlns="${ns}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `${hlavicka}<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>` +
        listy.map((l, i) => `<sheet name="${xml(l.jmeno)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        // vzorce jsou bez uložených výsledků → přepočítat při otevření
        `</sheets><calcPr fullCalcOnLoad="1"/></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `${hlavicka}<Relationships xmlns="${ns}/package/2006/relationships">` +
        listy
          .map(
            (l, i) =>
              `<Relationship Id="rId${i + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `</Relationships>`,
    ],
    ...listy.map((l): [string, string] => [l.cesta, l.xml]),
  ];
  return zip(soubory.map(([cesta, text]) => ({ cesta, data: enc.encode(text) })));
}

/** Jméno souboru z názvu tabulky (bez znaků, které Android / Windows nedovolí). */
export function nazevSouboru(nazev: string): string {
  return `${nazev.replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_").trim().slice(0, 80) || "tabulka"}.xlsx`;
}
