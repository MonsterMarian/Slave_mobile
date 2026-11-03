/**
 * Připojení k Supabase: adresa a publishable klíč z buildu (`.env.local`), v Nastavení jde přepsat.
 * Přihlášení e-mailem a heslem drží supabase-js sám v localStorage.
 * Schéma a pravidla přístupu: `supabase/schema.sql`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { jeText, nactiJson, ulozJson } from "./uloziste";

export const PRIPOJENI_KEY = "slave:supabase";

export interface Pripojeni {
  url: string;
  klic: string;
}

// Výchozí projekt z `.env.local` při buildu. Publishable klíč je veřejný z povahy věci (je v každém klientovi);
// k datům pustí jen přihlášeného vlastníka (RLS v schema.sql). Nastavení ho může přepsat.
const VYCHOZI: Pripojeni = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  klic: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};

export function nactiPripojeni(): Pripojeni {
  const p = nactiJson(PRIPOJENI_KEY) as Record<string, unknown> | null;
  return { url: jeText(p?.url) && p.url ? p.url : VYCHOZI.url, klic: jeText(p?.klic) && p.klic ? p.klic : VYCHOZI.klic };
}

export function ulozPripojeni(p: Pripojeni): void {
  ulozJson(PRIPOJENI_KEY, { url: p.url.trim().replace(/\/+$/, ""), klic: p.klic.trim() });
}

let sb: SupabaseClient | null = null;
let sbPro = "";

/** Klient pro uložené připojení, nebo null, když není vyplněné. */
export function klient(): SupabaseClient | null {
  const { url, klic } = nactiPripojeni();
  if (!/^https:\/\/\S+$/.test(url) || !klic) return null;
  if (sb && sbPro === `${url}|${klic}`) return sb;
  sb = createClient(url, klic);
  sbPro = `${url}|${klic}`;
  return sb;
}

/** Přihlášený uživatel (e-mail), nebo null. Bez sítě vrátí uloženou relaci. */
export async function prihlasenJako(): Promise<string | null> {
  const s = klient();
  if (!s) return null;
  const { data } = await s.auth.getSession();
  return data.session?.user.email ?? null;
}
