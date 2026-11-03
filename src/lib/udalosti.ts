/**
 * Kalendář v telefonu: události, měsíční mřížka a co patří do kterého dne.
 * Data jen v telefonu (`uloziste.ts`), s PC se nesynchronizuje.
 *
 * Dny jsou klíče `YYYY-MM-DD` v místním čase - řadí se i porovnávají jako
 * text a nehrozí posun o den přes UTC (viz `parseCas` v `kalendar.ts`).
 */
import { jeText, nactiJson, ulozJson } from "./uloziste";

export interface Udalost {
  id: string;
  nazev: string;
  /** první a poslední den, `YYYY-MM-DD`; `do >= od` */
  od: string;
  do: string;
  celyDen: boolean;
  /** `HH:MM`, u celodenních prázdné; `casDo` smí chybět */
  casOd: string;
  casDo: string;
  misto: string;
  poznamka: string;
}

export const KALENDAR_KEY = "slave:kalendar";

export const MESICE = [
  "leden", "únor", "březen", "duben", "květen", "červen",
  "červenec", "srpen", "září", "říjen", "listopad", "prosinec",
];
const MESICE_GEN = [
  "ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince",
];
const DNY = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
export const DNY_ZKR = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

const DEN_RE = /^\d{4}-\d{2}-\d{2}$/;
const CAS_RE = /^\d{2}:\d{2}$/;

export function klicDne(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function zKlice(klic: string): Date {
  const [r, m, d] = klic.split("-").map(Number);
  return new Date(r, m - 1, d);
}

/** Celé týdny od pondělí, které pokryjí měsíc (`mesic` 0-11): 4 až 6 řádků po 7 dnech. */
export function mrizkaMesice(rok: number, mesic: number): Date[] {
  const prvni = new Date(rok, mesic, 1);
  const posledni = new Date(rok, mesic + 1, 0);
  const start = new Date(rok, mesic, 1 - ((prvni.getDay() + 6) % 7));
  const dnu = Math.round((posledni.getTime() - start.getTime()) / 86_400_000) + 1;
  const pocet = Math.ceil(dnu / 7) * 7;
  // Přes datum, ne přičítáním milisekund: přechod na letní čas má den 23 h.
  return Array.from({ length: pocet }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function posunMesic(rok: number, mesic: number, o: number): { rok: number; mesic: number } {
  const d = new Date(rok, mesic + o, 1);
  return { rok: d.getFullYear(), mesic: d.getMonth() };
}

/** Události, které zasahují do dne: celodenní první, pak podle času začátku. */
export function udalostiDne(udalosti: Udalost[], klic: string): Udalost[] {
  return udalosti
    .filter((u) => u.od <= klic && klic <= u.do)
    .sort(
      (a, b) =>
        Number(b.celyDen) - Number(a.celyDen) ||
        (a.od < klic ? "" : a.casOd).localeCompare(b.od < klic ? "" : b.casOd) ||
        a.nazev.localeCompare(b.nazev, "cs"),
    );
}

/** „úterý 3. listopadu" */
export function popisDne(klic: string): string {
  const d = zKlice(klic);
  return `${DNY[d.getDay()]} ${d.getDate()}. ${MESICE_GEN[d.getMonth()]}`;
}

const kratce = (klic: string) => {
  const d = zKlice(klic);
  return `${d.getDate()}. ${d.getMonth() + 1}.`;
};

const hodina = (cas: string) => cas.replace(/^0(\d)/, "$1");

/** „Celý den", „9:00–10:30", u vícedenních i rozsah dnů. */
export function popisCasu(u: Udalost): string {
  const cas = u.celyDen ? "Celý den" : u.casDo ? `${hodina(u.casOd)}–${hodina(u.casDo)}` : hodina(u.casOd);
  if (u.od === u.do) return cas;
  return u.celyDen ? `${kratce(u.od)} – ${kratce(u.do)}` : `${kratce(u.od)} ${hodina(u.casOd)} – ${kratce(u.do)} ${u.casDo ? hodina(u.casDo) : ""}`.trim();
}

/** Chyba formuláře k ukázání, nebo null. */
export function zkontroluj(u: Udalost): string | null {
  if (!u.nazev.trim()) return "Chybí název.";
  if (!DEN_RE.test(u.od) || !DEN_RE.test(u.do)) return "Chybí datum.";
  if (u.do < u.od) return "Konec je dřív než začátek.";
  if (!u.celyDen) {
    if (!CAS_RE.test(u.casOd)) return "Chybí čas začátku (nebo zaškrtni Celý den).";
    if (u.casDo && u.od === u.do && u.casDo < u.casOd) return "Konec je dřív než začátek.";
  }
  return null;
}

function platna(x: unknown): Udalost | null {
  if (!x || typeof x !== "object") return null;
  const u = x as Record<string, unknown>;
  if (!jeText(u.id) || !jeText(u.nazev) || !jeText(u.od) || !DEN_RE.test(u.od)) return null;
  const doDne = jeText(u.do) && DEN_RE.test(u.do) && u.do >= u.od ? u.do : u.od;
  const casOd = jeText(u.casOd) && CAS_RE.test(u.casOd) ? u.casOd : "";
  return {
    id: u.id,
    nazev: u.nazev,
    od: u.od,
    do: doDne,
    celyDen: u.celyDen === true || !casOd,
    casOd,
    casDo: jeText(u.casDo) && CAS_RE.test(u.casDo) ? u.casDo : "",
    misto: jeText(u.misto) ? u.misto : "",
    poznamka: jeText(u.poznamka) ? u.poznamka : "",
  };
}

/** Poškozené události vypadnou, ostatní zůstanou. */
export function nactiUdalosti(): Udalost[] {
  const data = nactiJson(KALENDAR_KEY);
  const pole = Array.isArray(data) ? data : [];
  return pole.map(platna).filter((u): u is Udalost => u !== null);
}

export function ulozUdalosti(udalosti: Udalost[]): boolean {
  return ulozJson(KALENDAR_KEY, udalosti);
}
