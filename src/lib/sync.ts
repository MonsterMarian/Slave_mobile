/**
 * Synchronizace tabulek a kalendáře se Supabase (telefon ↔ PC).
 *
 * Telefon dál pracuje s localStorage (jde i offline). Synchronizace porovná tři verze každé položky:
 * místní, vzdálenou a poslední společnou (`slave:sync:<kolekce>`), takže pozná, kdo co změnil
 * nebo smazal - i když byl telefon mezitím offline. Když změnili oba, vyhraje vzdálená verze.
 * Spouští se po uložení, při startu, při návratu do appky a při změně v databázi (realtime).
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { klient } from "./supabase";
import { nactiTabulky, platna as platnaTabulka, TABULKY_KEY, type Tabulka } from "./tabulky";
import { KALENDAR_KEY, nactiUdalosti, platna as platnaUdalost, type Udalost } from "./udalosti";
import { nactiJson, ulozJson } from "./uloziste";

export type Kolekce = "tabulky" | "udalosti";
export const KOLEKCE: Kolekce[] = ["tabulky", "udalosti"];

/** JSON se seřazenými klíči - jsonb v databázi pořadí klíčů nedrží. */
export function stabilni(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stabilni).join(",")}]`;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stabilni(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(x);
}

export interface Slouceni<T> {
  vysledek: T[];
  nahrat: T[];
  smazat: string[];
  zaklad: Record<string, string>;
}

/** Tříbodové sloučení: `zaklad` = id → stabilní JSON verze, na které se obě strany naposledy shodly. */
export function sloucit<T extends { id: string }>(mistni: T[], vzdalene: T[], zaklad: Record<string, string>): Slouceni<T> {
  const r = new Map(vzdalene.map((x) => [x.id, x]));
  const l = new Map(mistni.map((x) => [x.id, x]));
  const vysledek: T[] = [];
  const nahrat: T[] = [];
  const smazat: string[] = [];

  for (const L of mistni) {
    const R = r.get(L.id);
    const B = zaklad[L.id];
    const sl = stabilni(L);
    if (R) {
      const sr = stabilni(R);
      if (sl === sr) vysledek.push(L);
      else if (sr === B) (vysledek.push(L), nahrat.push(L)); // změnil jen telefon
      else vysledek.push(R); // změnilo PC (nebo oba - vyhraje PC)
    } else if (B === undefined || sl !== B) {
      vysledek.push(L); // nové v telefonu, nebo upravené v telefonu a smazané jinde - úprava vyhraje
      nahrat.push(L);
    } // jinak smazané jinde a v telefonu beze změny → pryč
  }
  for (const R of vzdalene) {
    if (l.has(R.id)) continue;
    const B = zaklad[R.id];
    if (B === undefined || stabilni(R) !== B) vysledek.push(R); // nové jinde, nebo upravené jinde
    else smazat.push(R.id); // smazané v telefonu
  }
  return { vysledek, nahrat, smazat, zaklad: Object.fromEntries(vysledek.map((x) => [x.id, stabilni(x)])) };
}

type Radek = Record<string, unknown>;

interface Def<T> {
  klic: string;
  sloupce: string;
  nacti: () => T[];
  zRadku: (r: Radek) => T | null;
  naRadek: (x: T) => Radek;
}

const tabulky: Def<Tabulka> = {
  klic: TABULKY_KEY,
  sloupce: "id,nazev,listy,upraveno",
  nacti: nactiTabulky,
  zRadku: (r) => platnaTabulka({ ...r, upraveno: typeof r.upraveno === "string" ? Date.parse(r.upraveno) || 0 : 0 }),
  naRadek: (t) => ({ id: t.id, nazev: t.nazev, listy: t.listy, upraveno: new Date(t.upraveno || Date.now()).toISOString() }),
};

const udalosti: Def<Udalost> = {
  klic: KALENDAR_KEY,
  sloupce: "id,nazev,od,do,cely_den,cas_od,cas_do,misto,poznamka",
  nacti: nactiUdalosti,
  zRadku: (r) =>
    platnaUdalost({ id: r.id, nazev: r.nazev, od: r.od, do: r.do, celyDen: r.cely_den, casOd: r.cas_od, casDo: r.cas_do, misto: r.misto, poznamka: r.poznamka }),
  naRadek: (u) => ({ id: u.id, nazev: u.nazev, od: u.od, do: u.do, cely_den: u.celyDen, cas_od: u.casOd, cas_do: u.casDo, misto: u.misto, poznamka: u.poznamka }),
};

const DEF = { tabulky, udalosti } as unknown as Record<Kolekce, Def<{ id: string }>>;
const zakladKey = (k: Kolekce) => `slave:sync:${k}`;

// --- posluchači: pohledy se znovu načtou, když synchronizace změnila data v telefonu ---
type Stav = { chyba: string; posledni: number };
let stav: Stav = { chyba: "", posledni: 0 };
const naZmenu = new Map<string, Set<() => void>>();

/** `kanal`: kolekce, „prikazy" (nový stav příkazu) nebo „stav" (výsledek synchronizace). */
export function odebirej(kanal: Kolekce | "prikazy" | "stav", fn: () => void): () => void {
  if (!naZmenu.has(kanal)) naZmenu.set(kanal, new Set());
  naZmenu.get(kanal)!.add(fn);
  return () => void naZmenu.get(kanal)!.delete(fn);
}
const ohlas = (kanal: string) => naZmenu.get(kanal)?.forEach((fn) => fn());
export const stavSync = () => stav;

// --- jedna synchronizace kolekce; běhy jedné kolekce jdou po sobě ---
const fronta = new Map<Kolekce, Promise<void>>();

async function probehni(k: Kolekce): Promise<void> {
  const sb = klient();
  if (!sb || !(await sb.auth.getSession()).data.session) return;
  const d = DEF[k];
  const { data, error } = await sb.from(k).select(d.sloupce);
  if (error) throw new Error(error.message);
  const vzdalene = (data as unknown as Radek[]).map(d.zRadku).filter((x): x is { id: string } => x !== null);

  // Místní data se čtou až teď (po síti) a zapisují hned - mezi tím nemůže nic uložit pohled.
  const mistni = d.nacti();
  const s = sloucit(mistni, vzdalene, (nactiJson(zakladKey(k)) as Record<string, string> | null) ?? {});
  if (stabilni(s.vysledek) !== stabilni(mistni)) {
    ulozJson(d.klic, s.vysledek);
    ohlas(k);
  }
  if (s.nahrat.length) {
    const { error: e } = await sb.from(k).upsert(s.nahrat.map(d.naRadek));
    if (e) throw new Error(e.message);
  }
  if (s.smazat.length) {
    const { error: e } = await sb.from(k).delete().in("id", s.smazat);
    if (e) throw new Error(e.message);
  }
  // Základ až po úspěšném nahrání - když síť selže, příště se to pošle znovu.
  ulozJson(zakladKey(k), s.zaklad);
}

export function synchronizuj(k: Kolekce): Promise<void> {
  const dalsi = (fronta.get(k) ?? Promise.resolve()).then(() =>
    probehni(k).then(
      () => void (stav = { chyba: "", posledni: Date.now() }),
      (e: unknown) => void (stav = { ...stav, chyba: e instanceof Error ? e.message : String(e) }),
    ).then(() => ohlas("stav")),
  );
  fronta.set(k, dalsi);
  return dalsi;
}

const casovace = new Map<Kolekce, ReturnType<typeof setTimeout>>();
/** Synchronizace za chvíli - víc změn rychle po sobě je jeden běh. */
export function naplanuj(k: Kolekce, za = 800): void {
  clearTimeout(casovace.get(k));
  casovace.set(k, setTimeout(() => void synchronizuj(k), za));
}

/** Zapomenout společné verze (po odhlášení / změně účtu) - další běh nic nesmaže, jen sloučí. */
export function zapomenSync(): void {
  for (const k of KOLEKCE) localStorage.removeItem(zakladKey(k));
}

// --- realtime a spouštěče; jednou za běh appky (app-shell) ---
let kanal: RealtimeChannel | null = null;

function napojRealtime(): void {
  const sb = klient();
  if (kanal || !sb) return;
  kanal = sb.channel("slave-zmeny");
  for (const k of KOLEKCE) kanal.on("postgres_changes", { event: "*", schema: "public", table: k }, () => naplanuj(k, 300));
  kanal.on("postgres_changes", { event: "*", schema: "public", table: "prikazy" }, () => ohlas("prikazy"));
  kanal.subscribe();
}

/** Po přihlášení, startu nebo změně připojení: napojit realtime a srovnat obě kolekce. */
export async function obnovSync(): Promise<void> {
  const sb = klient();
  if (kanal) {
    void kanal.unsubscribe();
    kanal = null;
  }
  if (!sb || !(await sb.auth.getSession()).data.session) return;
  napojRealtime();
  await Promise.all(KOLEKCE.map(synchronizuj));
}

export function spustSync(): () => void {
  void obnovSync();
  const sb = klient();
  const auth = sb?.auth.onAuthStateChange((udalost) => {
    if (udalost === "SIGNED_IN" || udalost === "SIGNED_OUT") setTimeout(() => void obnovSync(), 0);
  });
  const viditelne = () => {
    if (document.visibilityState === "visible") KOLEKCE.forEach((k) => naplanuj(k, 0));
  };
  document.addEventListener("visibilitychange", viditelne);
  return () => {
    auth?.data.subscription.unsubscribe();
    document.removeEventListener("visibilitychange", viditelne);
  };
}
