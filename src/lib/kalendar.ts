// shortcut: spojení s PC je v UI vypnuté (2026-11-03) — vrátit, až uživatel řekne
import type { Udalost } from "./protocol";

/**
 * Začátek nebo konec události jako `Date`.
 *
 * Celodenní události chodí jako holé `YYYY-MM-DD`. `new Date("2026-11-03")`
 * by z toho udělal půlnoc UTC, tedy v Praze 1:00 - a v zimě v Americe
 * předchozí večer, takže by se událost propadla o den. Proto se skládá
 * ručně jako místní půlnoc.
 */
export function parseCas(value: string): Date {
  const day = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  return new Date(value);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const DNY = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];

/** „Dnes", „Zítra", jinak „středa 5. 11.". */
export function nazevDne(day: Date, now: Date): string {
  const diff = Math.round((startOfDay(day).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff === 0) return "Dnes";
  if (diff === 1) return "Zítra";
  if (diff === -1) return "Včera";
  return `${DNY[day.getDay()]} ${day.getDate()}. ${day.getMonth() + 1}.`;
}

export function formatHodina(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export interface DenUdalosti {
  key: string;
  nazev: string;
  udalosti: (Udalost & { od: Date })[];
}

/**
 * Události po dnech, seřazené podle začátku; celodenní první. Událost, která
 * začala dřív než dnes (vícedenní), se ukáže pod dneškem.
 */
export function poDnech(udalosti: Udalost[], now: Date): DenUdalosti[] {
  const today = startOfDay(now);
  const sorted = udalosti
    .map((u) => ({ ...u, od: parseCas(u.zacatek) }))
    .filter((u) => !Number.isNaN(u.od.getTime()))
    .sort((a, b) => a.od.getTime() - b.od.getTime());

  // Seřazené podle začátku, takže dny vznikají popořadě.
  const days = new Map<string, DenUdalosti>();
  for (const u of sorted) {
    const day = u.od < today ? today : startOfDay(u.od);
    const key = dayKey(day);
    if (!days.has(key)) days.set(key, { key, nazev: nazevDne(day, now), udalosti: [] });
    days.get(key)!.udalosti.push(u);
  }
  for (const d of days.values()) d.udalosti.sort((a, b) => Number(b.celodenni) - Number(a.celodenni));
  return [...days.values()];
}
