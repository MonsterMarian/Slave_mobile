/**
 * Akcentové barvy S/_ave (rozbor v docs/barvy.md).
 *
 * Mění se jen akcent (tlačítka, vybraný den / buňka, aktivní záložka, `/_` ve
 * wordmarku); povrchy zůstávají neutrální a chyby / mazání červené. Každá
 * barva má variantu pro tmavý a světlý režim a barvu textu na akcentu,
 * spočítané na kontrast WCAG AA (≥ 4,5:1) - hlídá to `barvy.test.ts`.
 *
 * Jediný zdroj hodnot: z `PALETY` se v `layout.tsx` generuje CSS
 * (`html[data-accent=…]`) a skript v hlavičce nasadí uloženou volbu před prvním
 * vykreslením, takže jiná barva neprobliká.
 */

export interface Varianta {
  akcent: string;
  /** text na plném akcentu (tlačítko) */
  text: string;
}

export interface Paleta {
  id: string;
  nazev: string;
  tmava: Varianta;
  svetla: Varianta;
}

const TMAVY_TEXT = "#09090B";
const BILA = "#FFFFFF";

export const PALETY: Paleta[] = [
  { id: "sky", nazev: "S/_ave modrá", tmava: { akcent: "#38BDF8", text: TMAVY_TEXT }, svetla: { akcent: "#0369A1", text: BILA } },
  { id: "orange", nazev: "Oranžová z loga", tmava: { akcent: "#F89848", text: TMAVY_TEXT }, svetla: { akcent: "#C2410C", text: BILA } },
  { id: "fb", nazev: "Facebook modrá", tmava: { akcent: "#4B9BFF", text: TMAVY_TEXT }, svetla: { akcent: "#0866FF", text: BILA } },
  { id: "of", nazev: "OnlyFans azurová", tmava: { akcent: "#00AFF0", text: TMAVY_TEXT }, svetla: { akcent: "#0077A8", text: BILA } },
  { id: "indigo", nazev: "Indigo", tmava: { akcent: "#8C95FF", text: TMAVY_TEXT }, svetla: { akcent: "#4F46E5", text: BILA } },
  { id: "excel", nazev: "Excel zelená", tmava: { akcent: "#33C481", text: TMAVY_TEXT }, svetla: { akcent: "#107C41", text: BILA } },
  { id: "violet", nazev: "Fialová (Material 3)", tmava: { akcent: "#D0BCFF", text: TMAVY_TEXT }, svetla: { akcent: "#6750A4", text: BILA } },
];

export const VYCHOZI_AKCENT = "sky";
export const ACCENT_KEY = "slave:accent";

/** Povrchy appky, na kterých akcent stojí (globals.css: --background, --card). */
export const POVRCHY = {
  tmava: ["#09090B", "#18181B"],
  svetla: ["#FDFDFD", "#FFFFFF"],
};

function svetlost(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastní poměr WCAG 2.x (1 až 21). */
export function kontrast(a: string, b: string): number {
  const [x, y] = [svetlost(a), svetlost(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** CSS pro `<style>` v hlavičce: akcent podle `data-accent` a režimu. */
export function akcentCss(): string {
  return PALETY.map(
    (p) =>
      `html[data-accent="${p.id}"]{--brand:${p.svetla.akcent};--brand-foreground:${p.svetla.text}}` +
      `html.dark[data-accent="${p.id}"]{--brand:${p.tmava.akcent};--brand-foreground:${p.tmava.text}}`,
  ).join("");
}

const listeners = new Set<() => void>();

export function getAkcent(): string {
  if (typeof document === "undefined") return VYCHOZI_AKCENT;
  return document.documentElement.dataset.accent ?? VYCHOZI_AKCENT;
}

export function getServerAkcent(): string {
  return VYCHOZI_AKCENT;
}

export function setAkcent(id: string): void {
  if (typeof document === "undefined" || !PALETY.some((p) => p.id === id)) return;
  document.documentElement.dataset.accent = id;
  try {
    localStorage.setItem(ACCENT_KEY, id);
  } catch {
    // soukromý režim - barva vydrží do zavření appky
  }
  for (const fn of listeners) fn();
}

export function subscribeAkcent(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
