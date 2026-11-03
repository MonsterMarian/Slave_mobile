// Původně kopie z repa Slave (desktop-agent/ui/src/components/dashboard/vzorce.ts, 2026-11-03); od 2026-11-03 tady
// rozšířená o další funkce (SUMIF, VLOOKUP, IFERROR, textové…) - Slave má zatím starší sadu. Test: vzorce.test.ts.
/* Mini-engine vzorců pro editor tabulek. Jména funkcí anglicky
   jako v souboru .xlsx (Excel je v souboru ukládá anglicky, ať je přepočítá),
   oddělovač argumentů „," i „;" (český zvyk; při uložení se převede na „,").
   shortcut: bez odkazů na jiné listy (List2!A1), bez datumových funkcí a maticových vzorců — přidat, až budou chybět. */

export class Chyba {
  kod: string
  constructor(kod: string) {
    this.kod = kod
  }
}
export type Hodnota = number | string | boolean | Chyba

const E_HODNOTA = "#HODNOTA!"
const E_DELENI = "#DĚLENÍ/0!"
const E_NAZEV = "#NÁZEV?"
const E_CYKLUS = "#CYKLUS!"
const E_SYNTAX = "#CHYBA!"
const E_NENI = "#NENÍ_K_DISPOZICI"
const E_CISLO = "#ČÍSLO!"

/** Rozsah = hodnoty po řádcích + počet sloupců (kvůli VLOOKUP / INDEX). */
type Rozsah = Hodnota[] & { sloupcu?: number }
type Arg = Hodnota | Rozsah

/** 0 → A, 25 → Z, 26 → AA */
export function nazevSloupce(c: number): string {
  let s = ""
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** „B12" → [11, 1] (řádek, sloupec od nuly) */
export function adresa(ref: string): [number, number] | null {
  const m = /^\$?([A-Z]{1,3})\$?(\d{1,7})$/.exec(ref.toUpperCase())
  if (!m || m[2] === "0") return null
  let c = 0
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64
  return [Number(m[2]) - 1, c - 1]
}

/** „;" mimo řetězce → „," (Excel v souboru chce čárku). */
export function normalizuj(vzorec: string): string {
  if (!vzorec.startsWith("=")) return vzorec
  let out = ""
  let vRetezci = false
  for (const ch of vzorec) {
    if (ch === '"') vRetezci = !vRetezci
    out += ch === ";" && !vRetezci ? "," : ch
  }
  return out
}

type Token = { t: "num" | "str" | "ref" | "rng" | "fn" | "op" | "(" | ")" | "," | "bool"; v: string }

const REF = String.raw`\$?[A-Z]{1,3}\$?\d+`
// pořadí skupin: číslo, řetězec, rozsah, funkce, TRUE/FALSE, odkaz, operátor, závorka/oddělovač
const TOKEN = new RegExp(
  String.raw`\s*(?:(\d+(?:\.\d+)?)|"((?:[^"]|"")*)"|(${REF}:${REF})|((?:_xlfn\.)?[A-Z][A-Z0-9.]*)\s*\(|(TRUE|FALSE)\b|(${REF})|(<=|>=|<>|[-+*/^&=<>])|([(),;]))`,
  "iy",
)

function tokeny(s: string): Token[] {
  const out: Token[] = []
  const re = TOKEN
  let i = 0
  while (i < s.length) {
    re.lastIndex = i
    const m = re.exec(s)
    if (!m) {
      if (/^\s*$/.test(s.slice(i))) break
      throw new Chyba(E_SYNTAX)
    }
    i = re.lastIndex
    if (m[1] !== undefined) out.push({ t: "num", v: m[1] })
    else if (m[2] !== undefined) out.push({ t: "str", v: m[2].replace(/""/g, '"') })
    else if (m[3] !== undefined) out.push({ t: "rng", v: m[3].toUpperCase() })
    else if (m[4] !== undefined) out.push({ t: "fn", v: m[4].toUpperCase() })
    else if (m[5] !== undefined) out.push({ t: "bool", v: m[5].toUpperCase() })
    else if (m[6] !== undefined) out.push({ t: "ref", v: m[6].toUpperCase() })
    else if (m[7] !== undefined) out.push({ t: "op", v: m[7] })
    else out.push({ t: m[8] === "(" ? "(" : m[8] === ")" ? ")" : ",", v: m[8] })
  }
  return out
}

function cislo(v: Hodnota): number {
  if (v instanceof Chyba) throw v
  if (typeof v === "number") return v
  if (typeof v === "boolean") return v ? 1 : 0
  if (v.trim() === "") return 0
  const n = Number(v.trim().replace(",", "."))
  if (Number.isNaN(n)) throw new Chyba(E_HODNOTA)
  return n
}

function text(v: Hodnota): string {
  if (v instanceof Chyba) throw v
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
  return typeof v === "number" ? formatuj(v) : v
}

function pravda(v: Hodnota): boolean {
  if (typeof v === "boolean") return v
  if (typeof v === "string" && /^(true|false)$/i.test(v)) return v.toUpperCase() === "TRUE"
  return cislo(v) !== 0
}

function porovnej(a: Hodnota, b: Hodnota, op: string): boolean {
  const d =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : text(a).localeCompare(text(b), "cs", { sensitivity: "base" })
  return op === "=" ? d === 0 : op === "<>" ? d !== 0 : op === "<" ? d < 0 : op === ">" ? d > 0 : op === "<=" ? d <= 0 : d >= 0
}

/** Čísla z argumentů funkcí: v rozsahu se text a prázdné přeskočí (jako Excel). */
function cisla(args: Arg[]): number[] {
  const out: number[] = []
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const v of a) {
        if (v instanceof Chyba) throw v
        if (typeof v === "number") out.push(v)
      }
    } else out.push(cislo(a))
  }
  return out
}

const pole = (a: Arg | undefined): Hodnota[] => (a === undefined ? [] : Array.isArray(a) ? a : [a])

function rozsah(a: Arg | undefined): { data: Hodnota[]; sl: number; radku: number } {
  if (!Array.isArray(a)) throw new Chyba(E_HODNOTA)
  const sl = (a as Rozsah).sloupcu ?? 1
  return { data: a, sl, radku: Math.ceil(a.length / sl) }
}

/** Kritérium jako v COUNTIF: 5, ">5", "<>x", "=", "Jan*", "?a" (zástupné znaky * a ?). */
export function kriterium(k: Hodnota): (v: Hodnota) => boolean {
  if (k instanceof Chyba) throw k
  if (typeof k !== "string") return (v) => !(v instanceof Chyba) && typeof v === typeof k && porovnej(v, k, "=")
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(k)!
  const op = m[1] ?? "="
  const s = m[2]
  const n = s.trim() === "" ? NaN : Number(s.trim().replace(",", "."))
  if (!Number.isNaN(n)) return (v) => (typeof v === "number" ? porovnej(v, n, op) : op === "<>")
  if (s === "") return (v) => (op === "<>" ? v !== "" : op === "=" ? v === "" : false)
  if ((op === "=" || op === "<>") && /[*?]/.test(s)) {
    const vzor = s.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[\\s\\S]*").replace(/\?/g, ".")
    const re = new RegExp(`^${vzor}$`, "i")
    return (v) => !(v instanceof Chyba) && re.test(text(v)) === (op === "=")
  }
  return (v) => (typeof v === "string" ? porovnej(v, s, op) : op === "<>")
}

/** Indexy, kde platí všechny dvojice (rozsah, kritérium) od `od` - COUNTIFS / SUMIFS. */
function shody(a: Arg[], od: number): number[] {
  const dvojice: [Hodnota[], (v: Hodnota) => boolean][] = []
  for (let i = od; i < a.length; i += 2) dvojice.push([pole(a[i]), kriterium(jedna(a[i + 1]))])
  if (!dvojice.length || dvojice.some(([r]) => r.length !== dvojice[0][0].length)) throw new Chyba(E_HODNOTA)
  return dvojice[0][0].map((_, i) => i).filter((i) => dvojice.every(([r, f]) => f(r[i])))
}

/** Součet čísel (text a prázdné se přeskočí, chyba se propaguje). */
function secti(h: Hodnota[]): number {
  let s = 0
  for (const v of h) {
    if (v instanceof Chyba) throw v
    if (typeof v === "number") s += v
  }
  return s
}

function zaokrouhli(a: Arg[], fn: (x: number) => number): number {
  const f = 10 ** cislo(jedna(a[1] ?? 0))
  return fn(cislo(jedna(a[0])) * f) / f
}

/** Pozice x v seznamu: přesně (text i se zástupnými znaky * ?), nebo poslední ≤ x (seřazený seznam). -1 = není. */
function najdi(x: Hodnota, seznam: Hodnota[], presne: boolean): number {
  if (presne) {
    const f = kriterium(typeof x === "string" ? `=${x}` : x)
    return seznam.findIndex(f)
  }
  let nalez = -1
  for (let i = 0; i < seznam.length; i++) {
    const v = seznam[i]
    if (v instanceof Chyba || typeof v !== typeof x) continue
    if (porovnej(v, x, "<=")) nalez = i
    else break
  }
  return nalez
}

const nezaporne = (n: number) => {
  if (n < 0) throw new Chyba(E_HODNOTA)
  return n
}

function ktyNejvetsi(a: Arg[], smer: 1 | -1): number {
  const n = cisla([a[0]]).sort((x, y) => smer * (y - x))
  const k = Math.ceil(cislo(jedna(a[1])))
  if (k < 1 || k > n.length) throw new Chyba(E_CISLO)
  return n[k - 1]
}

function prumerKdyz(a: Arg[]): number {
  const r = pole(a[0])
  const s = a[2] === undefined ? r : pole(a[2])
  const f = kriterium(jedna(a[1]))
  const n = r.flatMap((v, i) => (f(v) && typeof s[i] === "number" ? [s[i] as number] : []))
  if (!n.length) throw new Chyba(E_DELENI)
  return n.reduce((x, y) => x + y, 0) / n.length
}

const FUNKCE: Record<string, (a: Arg[]) => Hodnota> = {
  // --- čísla
  SUM: (a) => cisla(a).reduce((s, x) => s + x, 0),
  AVERAGE: (a) => {
    const n = cisla(a)
    if (!n.length) throw new Chyba(E_DELENI)
    return n.reduce((s, x) => s + x, 0) / n.length
  },
  MIN: (a) => (cisla(a).length ? Math.min(...cisla(a)) : 0),
  MAX: (a) => (cisla(a).length ? Math.max(...cisla(a)) : 0),
  COUNT: (a) => cisla(a).length,
  COUNTA: (a) => a.flat().filter((v) => v !== "").length,
  COUNTBLANK: (a) => pole(a[0]).filter((v) => v === "").length,
  PRODUCT: (a) => cisla(a).reduce((s, x) => s * x, 1),
  MEDIAN: (a) => {
    const n = cisla(a).sort((x, y) => x - y)
    if (!n.length) throw new Chyba(E_CISLO)
    const p = n.length >> 1
    return n.length % 2 ? n[p] : (n[p - 1] + n[p]) / 2
  },
  LARGE: (a) => ktyNejvetsi(a, 1),
  SMALL: (a) => ktyNejvetsi(a, -1),
  SUMPRODUCT: (a) => {
    const r = a.map(pole)
    if (!r.length || r.some((x) => x.length !== r[0].length)) throw new Chyba(E_HODNOTA)
    return r[0].reduce<number>((s, _, i) => s + r.reduce((p, x) => p * (typeof x[i] === "number" ? (x[i] as number) : 0), 1), 0)
  },
  ROUND: (a) => zaokrouhli(a, Math.round),
  ROUNDUP: (a) => zaokrouhli(a, (x) => Math.sign(x) * Math.ceil(Math.abs(x) - 1e-9)),
  ROUNDDOWN: (a) => zaokrouhli(a, Math.trunc),
  INT: (a) => Math.floor(cislo(jedna(a[0]))),
  MOD: (a) => {
    const n = cislo(jedna(a[0]))
    const d = cislo(jedna(a[1]))
    if (d === 0) throw new Chyba(E_DELENI)
    return n - d * Math.floor(n / d)
  },
  POWER: (a) => cislo(jedna(a[0])) ** cislo(jedna(a[1])),
  SQRT: (a) => {
    const n = cislo(jedna(a[0]))
    if (n < 0) throw new Chyba(E_CISLO)
    return Math.sqrt(n)
  },
  ABS: (a) => Math.abs(cislo(jedna(a[0]))),
  PI: () => Math.PI,
  // --- s podmínkou
  SUMIF: (a) => {
    const r = pole(a[0])
    const s = a[2] === undefined ? r : pole(a[2])
    const f = kriterium(jedna(a[1]))
    return secti(r.flatMap((v, i) => (f(v) ? [s[i] ?? ""] : [])))
  },
  SUMIFS: (a) => {
    const s = pole(a[0])
    return secti(shody(a, 1).map((i) => s[i] ?? ""))
  },
  COUNTIF: (a) => pole(a[0]).filter(kriterium(jedna(a[1]))).length,
  COUNTIFS: (a) => shody(a, 0).length,
  AVERAGEIF: prumerKdyz,
  // --- logika
  IF: (a) => (pravda(jedna(a[0])) ? jedna(a[1] ?? true) : jedna(a[2] ?? false)),
  IFS: (a) => {
    for (let i = 0; i + 1 < a.length; i += 2) if (pravda(jedna(a[i]))) return jedna(a[i + 1])
    throw new Chyba(E_NENI)
  },
  IFERROR: (a) => (jedna(a[0]) instanceof Chyba ? jedna(a[1] ?? "") : jedna(a[0])),
  CHOOSE: (a) => {
    const i = Math.trunc(cislo(jedna(a[0])))
    if (i < 1 || i >= a.length) throw new Chyba(E_HODNOTA)
    return jedna(a[i])
  },
  AND: (a) => a.flat().every((v) => pravda(v)),
  OR: (a) => a.flat().some((v) => pravda(v)),
  NOT: (a) => !pravda(jedna(a[0])),
  ISBLANK: (a) => jedna(a[0]) === "",
  ISNUMBER: (a) => typeof jedna(a[0]) === "number",
  ISTEXT: (a) => {
    const v = jedna(a[0])
    return typeof v === "string" && v !== ""
  },
  ISERROR: (a) => jedna(a[0]) instanceof Chyba,
  // --- text
  CONCAT: (a) => a.flat().map(text).join(""),
  CONCATENATE: (a) => a.map((x) => text(jedna(x))).join(""),
  TEXTJOIN: (a) => {
    const oddel = text(jedna(a[0]))
    const bezPrazdnych = pravda(jedna(a[1]))
    return a
      .slice(2)
      .flatMap(pole)
      .map(text)
      .filter((t) => !bezPrazdnych || t !== "")
      .join(oddel)
  },
  LEN: (a) => text(jedna(a[0])).length,
  UPPER: (a) => text(jedna(a[0])).toLocaleUpperCase("cs"),
  LOWER: (a) => text(jedna(a[0])).toLocaleLowerCase("cs"),
  PROPER: (a) => text(jedna(a[0])).toLocaleLowerCase("cs").replace(/(^|[^\p{L}])(\p{L})/gu, (_, p: string, z: string) => p + z.toLocaleUpperCase("cs")),
  TRIM: (a) => text(jedna(a[0])).trim().replace(/ {2,}/g, " "),
  LEFT: (a) => text(jedna(a[0])).slice(0, nezaporne(cislo(jedna(a[1] ?? 1)))),
  RIGHT: (a) => {
    const n = nezaporne(cislo(jedna(a[1] ?? 1)))
    return n === 0 ? "" : text(jedna(a[0])).slice(-n)
  },
  MID: (a) => {
    const od = cislo(jedna(a[1]))
    if (od < 1) throw new Chyba(E_HODNOTA)
    return text(jedna(a[0])).slice(od - 1, od - 1 + nezaporne(cislo(jedna(a[2]))))
  },
  FIND: (a) => {
    const i = text(jedna(a[1])).indexOf(text(jedna(a[0])), cislo(jedna(a[2] ?? 1)) - 1)
    if (i < 0) throw new Chyba(E_HODNOTA)
    return i + 1
  },
  SEARCH: (a) => {
    const kde = text(jedna(a[1])).toLocaleLowerCase("cs")
    const i = kde.indexOf(text(jedna(a[0])).toLocaleLowerCase("cs"), cislo(jedna(a[2] ?? 1)) - 1)
    if (i < 0) throw new Chyba(E_HODNOTA)
    return i + 1
  },
  SUBSTITUTE: (a) => {
    const t = text(jedna(a[0]))
    const stary = text(jedna(a[1]))
    const novy = text(jedna(a[2]))
    if (stary === "") return t
    if (a[3] === undefined) return t.split(stary).join(novy)
    let i = -1
    for (let k = cislo(jedna(a[3])); k > 0; k--) if ((i = t.indexOf(stary, i + 1)) < 0) return t
    return t.slice(0, i) + novy + t.slice(i + stary.length)
  },
  REPT: (a) => text(jedna(a[0])).repeat(nezaporne(Math.trunc(cislo(jedna(a[1]))))),
  EXACT: (a) => text(jedna(a[0])) === text(jedna(a[1])),
  VALUE: (a) => cislo(jedna(a[0])),
  // --- vyhledávání
  VLOOKUP: (a) => {
    const { data, sl, radku } = rozsah(a[1])
    const c = Math.trunc(cislo(jedna(a[2])))
    if (c < 1 || c > sl) throw new Chyba(E_HODNOTA)
    const presne = a[3] !== undefined && !pravda(jedna(a[3]))
    const r = najdi(jedna(a[0]), Array.from({ length: radku }, (_, i) => data[i * sl]), presne)
    if (r < 0) throw new Chyba(E_NENI)
    return data[r * sl + c - 1] ?? ""
  },
  HLOOKUP: (a) => {
    const { data, sl, radku } = rozsah(a[1])
    const r = Math.trunc(cislo(jedna(a[2])))
    if (r < 1 || r > radku) throw new Chyba(E_HODNOTA)
    const presne = a[3] !== undefined && !pravda(jedna(a[3]))
    const c = najdi(jedna(a[0]), data.slice(0, sl), presne)
    if (c < 0) throw new Chyba(E_NENI)
    return data[(r - 1) * sl + c] ?? ""
  },
  XLOOKUP: (a) => {
    const i = najdi(jedna(a[0]), pole(a[1]), true)
    if (i >= 0) return pole(a[2])[i] ?? ""
    if (a[3] !== undefined) return jedna(a[3])
    throw new Chyba(E_NENI)
  },
  MATCH: (a) => {
    const i = najdi(jedna(a[0]), pole(a[1]), a[2] !== undefined && cislo(jedna(a[2])) === 0)
    if (i < 0) throw new Chyba(E_NENI)
    return i + 1
  },
  INDEX: (a) => {
    const { data, sl, radku } = rozsah(a[0])
    let r = Math.trunc(cislo(jedna(a[1])))
    let c = a[2] === undefined ? 1 : Math.trunc(cislo(jedna(a[2])))
    if (radku === 1 && a[2] === undefined) [r, c] = [1, r] // INDEX(A1:E1; 3) = třetí v řádku
    if (r < 1 || r > radku || c < 1 || c > sl) throw new Chyba(E_HODNOTA)
    return data[(r - 1) * sl + c - 1] ?? ""
  },
}

/** Funkce, které začínají rozepsaným slovem na konci vzorce (`=SU` → SUM, SUMIF…); mimo vzorec a v řetězci nic. */
export function napoveda(raw: string, max = 8): { slovo: string; funkce: string[] } {
  if (!raw.startsWith("=") || (raw.match(/"/g)?.length ?? 0) % 2) return { slovo: "", funkce: [] }
  const slovo = /(?:^|[^A-Za-z0-9_.$])([A-Za-z][A-Za-z0-9.]*)$/.exec(raw)?.[1] ?? ""
  if (!slovo || /\d/.test(slovo)) return { slovo, funkce: [] } // A1, B12 = odkaz na buňku
  const s = slovo.toUpperCase()
  const funkce = Object.keys(FUNKCE)
    .filter((f) => f.startsWith(s) && f !== s)
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, max)
  return { slovo, funkce }
}

/** Funkce, které Excel v souboru .xlsx chce s předponou `_xlfn.` (novější než Excel 2007). */
export const XLFN = ["CONCAT", "TEXTJOIN", "IFS", "XLOOKUP"]

function jedna(v: Arg | undefined): Hodnota {
  if (v === undefined) return ""
  if (Array.isArray(v)) throw new Chyba(E_HODNOTA)
  return v
}

/** Spočítá celou mřížku: hodnoty buněk (vzorce vyhodnocené, čísla jako number). */
export function spocitej(bunky: string[][]): Hodnota[][] {
  const memo = new Map<string, Hodnota>()
  const zasobnik = new Set<string>()

  const bunka = (r: number, c: number): Hodnota => {
    const k = `${r},${c}`
    const hotovo = memo.get(k)
    if (hotovo !== undefined) return hotovo
    if (zasobnik.has(k)) throw new Chyba(E_CYKLUS)
    const raw = bunky[r]?.[c] ?? ""
    let v: Hodnota
    if (raw.startsWith("=") && raw.length > 1) {
      zasobnik.add(k)
      try {
        v = vyraz(raw.slice(1))
      } catch (e) {
        v = e instanceof Chyba ? e : new Chyba(E_SYNTAX)
      } finally {
        zasobnik.delete(k)
      }
    } else {
      const n = raw.trim() === "" ? NaN : Number(raw.trim().replace(",", "."))
      v = Number.isNaN(n) ? raw : n
    }
    memo.set(k, v)
    return v
  }

  const vyraz = (src: string): Hodnota => {
    const tk = tokeny(src)
    let i = 0
    const peek = () => tk[i]
    const op = (...ops: string[]) => tk[i]?.t === "op" && ops.includes(tk[i].v)

    const primar = (): Hodnota | Hodnota[] => {
      const t = tk[i++]
      if (!t) throw new Chyba(E_SYNTAX)
      if (t.t === "num") return Number(t.v)
      if (t.t === "str") return t.v
      if (t.t === "bool") return t.v === "TRUE"
      if (t.t === "ref") {
        const a = adresa(t.v)
        if (!a) throw new Chyba(E_NAZEV)
        return bunka(a[0], a[1])
      }
      if (t.t === "rng") {
        // rozsah = pole hodnot; v aritmetice ho jedna() odmítne (#HODNOTA!)
        const [z, k] = t.v.split(":").map(adresa)
        if (!z || !k) throw new Chyba(E_NAZEV)
        const out: Rozsah = []
        for (let r = Math.min(z[0], k[0]); r <= Math.max(z[0], k[0]); r++)
          for (let c = Math.min(z[1], k[1]); c <= Math.max(z[1], k[1]); c++) out.push(bunka(r, c))
        out.sloupcu = Math.abs(k[1] - z[1]) + 1
        return out
      }
      if (t.t === "fn") {
        const args: Arg[] = []
        if (peek()?.t !== ")") {
          for (;;) {
            args.push(argument())
            if (peek()?.t === ",") i++
            else break
          }
        }
        if (tk[i++]?.t !== ")") throw new Chyba(E_SYNTAX)
        const f = FUNKCE[t.v.replace(/^_XLFN\./, "")]
        if (!f) throw new Chyba(E_NAZEV)
        return f(args)
      }
      if (t.t === "(") {
        const v = porovnani()
        if (tk[i++]?.t !== ")") throw new Chyba(E_SYNTAX)
        return v
      }
      if (t.t === "op" && (t.v === "-" || t.v === "+")) {
        const v = cislo(jedna(primar()))
        return t.v === "-" ? -v : v
      }
      throw new Chyba(E_SYNTAX)
    }

    const mocnina = (): Hodnota | Hodnota[] => {
      let a = primar()
      while (op("^")) {
        i++
        a = cislo(jedna(a)) ** cislo(jedna(primar()))
      }
      return a
    }
    const soucin = (): Hodnota | Hodnota[] => {
      let a = mocnina()
      while (op("*", "/")) {
        const o = tk[i++].v
        const b = cislo(jedna(mocnina()))
        if (o === "/" && b === 0) throw new Chyba(E_DELENI)
        a = o === "*" ? cislo(jedna(a)) * b : cislo(jedna(a)) / b
      }
      return a
    }
    const soucet = (): Hodnota | Hodnota[] => {
      let a = soucin()
      while (op("+", "-")) {
        const o = tk[i++].v
        const b = cislo(jedna(soucin()))
        a = o === "+" ? cislo(jedna(a)) + b : cislo(jedna(a)) - b
      }
      return a
    }
    const spojeni = (): Hodnota | Hodnota[] => {
      let a = soucet()
      while (op("&")) {
        i++
        a = text(jedna(a)) + text(jedna(soucet()))
      }
      return a
    }
    const porovnani = (): Hodnota | Hodnota[] => {
      let a = spojeni()
      while (op("=", "<>", "<", ">", "<=", ">=")) {
        const o = tk[i++].v
        a = porovnej(jedna(a), jedna(spojeni()), o)
      }
      return a
    }

    // Chyba uvnitř argumentu je hodnota (jako v Excelu: IFERROR, IF s chybou v nepoužité větvi).
    // Zbytek argumentu se přeskočí po čárku / závorku na stejné úrovni; syntaktická chyba platí pro celý vzorec.
    const argument = (): Arg => {
      try {
        return porovnani()
      } catch (e) {
        if (!(e instanceof Chyba) || e.kod === E_SYNTAX) throw e
        for (let hloubka = 0; i < tk.length; i++) {
          const x = tk[i]
          if (x.t === "fn" || x.t === "(") hloubka++
          else if (x.t === ")" && hloubka-- === 0) break
          else if (x.t === "," && hloubka === 0) break
        }
        return e
      }
    }

    const v = porovnani()
    if (i < tk.length) throw new Chyba(E_SYNTAX)
    return jedna(v)
  }

  return bunky.map((row, r) => row.map((_, c) => bunka(r, c)))
}

export function formatuj(v: Hodnota): string {
  if (v instanceof Chyba) return v.kod
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return E_HODNOTA
    return v.toLocaleString("cs-CZ", { maximumFractionDigits: 10, useGrouping: false })
  }
  return v
}
