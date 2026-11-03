// Zkopírováno beze změny logiky z repa Slave: desktop-agent/ui/src/components/dashboard/vzorce.ts (2026-11-03). Test tady: vzorce.test.ts.
/* Mini-engine vzorců pro editor tabulek (Tabulka.tsx). Jména funkcí anglicky
   jako v souboru .xlsx (Excel je v souboru ukládá anglicky, ať je přepočítá),
   oddělovač argumentů „," i „;" (český zvyk; při uložení se převede na „,").
   Self-check: `node scripts/vzorce.check.ts` z desktop-agent/.
   shortcut: bez odkazů na jiné listy (List2!A1) a bez datumových funkcí — přidat, až budou chybět. */

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
  String.raw`\s*(?:(\d+(?:\.\d+)?)|"((?:[^"]|"")*)"|(${REF}:${REF})|([A-Z][A-Z0-9.]*)\s*\(|(TRUE|FALSE)\b|(${REF})|(<=|>=|<>|[-+*/^&=<>])|([(),;]))`,
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
function cisla(args: (Hodnota | Hodnota[])[]): number[] {
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

const FUNKCE: Record<string, (a: (Hodnota | Hodnota[])[]) => Hodnota> = {
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
  IF: (a) => (pravda(jedna(a[0])) ? jedna(a[1] ?? true) : jedna(a[2] ?? false)),
  ROUND: (a) => {
    const f = 10 ** cislo(jedna(a[1] ?? 0))
    return Math.round(cislo(jedna(a[0])) * f) / f
  },
  ABS: (a) => Math.abs(cislo(jedna(a[0]))),
  AND: (a) => a.flat().every((v) => pravda(v)),
  OR: (a) => a.flat().some((v) => pravda(v)),
  NOT: (a) => !pravda(jedna(a[0])),
  CONCAT: (a) => a.flat().map(text).join(""),
  LEN: (a) => text(jedna(a[0])).length,
}

function jedna(v: Hodnota | Hodnota[] | undefined): Hodnota {
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
        const out: Hodnota[] = []
        for (let r = Math.min(z[0], k[0]); r <= Math.max(z[0], k[0]); r++)
          for (let c = Math.min(z[1], k[1]); c <= Math.max(z[1], k[1]); c++) out.push(bunka(r, c))
        return out
      }
      if (t.t === "fn") {
        const f = FUNKCE[t.v]
        if (!f) throw new Chyba(E_NAZEV)
        const args: (Hodnota | Hodnota[])[] = []
        if (peek()?.t !== ")") {
          for (;;) {
            args.push(porovnani())
            if (peek()?.t === ",") i++
            else break
          }
        }
        if (tk[i++]?.t !== ")") throw new Chyba(E_SYNTAX)
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
