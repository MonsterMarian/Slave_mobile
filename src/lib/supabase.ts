/**
 * Připojení k Supabase: společný projekt s MicroWins a BetterNotes, jeden účet pro všechny appky.
 * Přihlášení e-mailem a heslem drží supabase-js sám v localStorage.
 * Schéma a pravidla přístupu: `supabase/schema.sql`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { nactiJson, ulozJson } from "./uloziste";

// Publishable klíč je veřejný z povahy věci (je v každém klientovi); k datům pustí jen přihlášeného vlastníka (RLS).
export const SUPABASE_URL = "https://mgxbvayypbrrbdzurgcj.supabase.co";
export const SUPABASE_KEY = "sb_publishable_ejAce0IsaPlrg8CyrzsePQ_LrDDn4ll";

const PROJEKT_KEY = "slave:projekt";
const STARY_PROJEKT = "tvttqesgnzzrtfecrqjt";
const ref = (url: unknown) => (typeof url === "string" ? /^https:\/\/([^./]+)\./.exec(url)?.[1] : undefined);

/**
 * Jednou po přechodu na jiný projekt: zahodit dřív zadané připojení, starou relaci a základ synchronizace
 * (`slave:sync:<kolekce>` ze sync.ts). První synchronizace pak jen sloučí podle id - nic nesmaže.
 */
export function prejdiNaProjekt(): void {
  try {
    if (nactiJson(PROJEKT_KEY) === SUPABASE_URL) return;
    const stare = nactiJson("slave:supabase") as { url?: unknown } | null;
    for (const r of new Set([STARY_PROJEKT, ref(stare?.url)])) {
      if (r && r !== ref(SUPABASE_URL)) localStorage.removeItem(`sb-${r}-auth-token`);
    }
    for (const k of ["slave:supabase", "slave:sync:tabulky", "slave:sync:udalosti"]) localStorage.removeItem(k);
    ulozJson(PROJEKT_KEY, SUPABASE_URL);
  } catch {
    // bez úložiště není co mazat
  }
}

let sb: SupabaseClient | null = null;

export function klient(): SupabaseClient {
  if (!sb) {
    prejdiNaProjekt();
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return sb;
}

/** Přihlášený uživatel (e-mail), nebo null. Bez sítě vrátí uloženou relaci. */
export async function prihlasenJako(): Promise<string | null> {
  const { data } = await klient().auth.getSession();
  return data.session?.user.email ?? null;
}
