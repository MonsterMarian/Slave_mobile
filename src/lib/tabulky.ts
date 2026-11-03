/**
 * Tabulky v telefonu: sešity s listy, buňky jako text (vzorce začínají `=`).
 * Výpočet je v `vzorce.ts`, data jen v telefonu (`uloziste.ts`).
 *
 * shortcut: všechny tabulky v jednom klíči localStorage (strop WebView ~5 MB) - rozdělit po tabulkách, až se tam nevejdou.
 * Export do .xlsx: `xlsx.ts` (bez knihovny); import .xlsx zatím ne.
 */
import { jeText, nactiJson, noveId, ulozJson } from "./uloziste";

export interface List {
  id: string;
  nazev: string;
  /** klíč `řádek,sloupec` od nuly; prázdné buňky tu nejsou */
  bunky: Record<string, string>;
}

export interface Tabulka {
  id: string;
  nazev: string;
  listy: List[];
  /** ms od epochy, kvůli řazení v seznamu */
  upraveno: number;
}

export const TABULKY_KEY = "slave:tabulky";
export const MAX_RADKU = 1000;
export const MAX_SLOUPCU = 100;

export function novyList(nazev: string): List {
  return { id: noveId(), nazev, bunky: {} };
}

export function novaTabulka(nazev: string): Tabulka {
  return { id: noveId(), nazev, listy: [novyList("List1")], upraveno: Date.now() };
}

/** Poslední použitý řádek a sloupec (-1, když je list prázdný). */
function konec(list: List): [number, number] {
  let r = -1;
  let c = -1;
  for (const k of Object.keys(list.bunky)) {
    const [kr, kc] = k.split(",").map(Number);
    if (kr > r) r = kr;
    if (kc > c) c = kc;
  }
  return [r, c];
}

/** Kolik řádků a sloupců ukázat: aspoň 50 × 10, s rezervou za obsahem, nejvýš 1000 × 100. */
export function rozmer(list: List): { radky: number; sloupce: number } {
  const [r, c] = konec(list);
  return {
    radky: Math.min(MAX_RADKU, Math.max(50, r + 11)),
    sloupce: Math.min(MAX_SLOUPCU, Math.max(10, c + 3)),
  };
}

/** Hustá mřížka přes použitou oblast - vstup pro `spocitej`. */
export function mrizka(list: List): string[][] {
  const [r, c] = konec(list);
  return Array.from({ length: r + 1 }, (_, i) => Array.from({ length: c + 1 }, (_, j) => list.bunky[`${i},${j}`] ?? ""));
}

export function nastavBunku(list: List, r: number, c: number, hodnota: string): List {
  const bunky = { ...list.bunky };
  if (hodnota === "") delete bunky[`${r},${c}`];
  else bunky[`${r},${c}`] = hodnota;
  return { ...list, bunky };
}

function platnyList(x: unknown): List | null {
  if (!x || typeof x !== "object") return null;
  const l = x as Record<string, unknown>;
  if (!jeText(l.id) || !jeText(l.nazev)) return null;
  const bunky: Record<string, string> = {};
  if (l.bunky && typeof l.bunky === "object") {
    for (const [k, v] of Object.entries(l.bunky)) {
      const m = /^(\d+),(\d+)$/.exec(k);
      if (m && jeText(v) && v !== "" && Number(m[1]) < MAX_RADKU && Number(m[2]) < MAX_SLOUPCU) bunky[k] = v;
    }
  }
  return { id: l.id, nazev: l.nazev, bunky };
}

function platna(x: unknown): Tabulka | null {
  if (!x || typeof x !== "object") return null;
  const t = x as Record<string, unknown>;
  if (!jeText(t.id) || !jeText(t.nazev)) return null;
  const listy = (Array.isArray(t.listy) ? t.listy : []).map(platnyList).filter((l): l is List => l !== null);
  return {
    id: t.id,
    nazev: t.nazev,
    listy: listy.length ? listy : [novyList("List1")],
    upraveno: typeof t.upraveno === "number" ? t.upraveno : 0,
  };
}

/** Poškozené tabulky a buňky vypadnou, ostatní zůstanou. */
export function nactiTabulky(): Tabulka[] {
  const data = nactiJson(TABULKY_KEY);
  return (Array.isArray(data) ? data : []).map(platna).filter((t): t is Tabulka => t !== null);
}

export function ulozTabulky(tabulky: Tabulka[]): boolean {
  return ulozJson(TABULKY_KEY, tabulky);
}
