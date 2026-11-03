#!/usr/bin/env node
/**
 * Data S/_ave v Supabase z příkazové řádky - nástroj pro Claude Code na PC (spouští ho pc/most.mjs).
 *
 *   node pc/db.mjs seznam tabulky|udalosti        přehled (u tabulek bez buněk)
 *   node pc/db.mjs ukaz tabulky|udalosti <id>     celý záznam jako JSON
 *   node pc/db.mjs uloz tabulky|udalosti [json]   vloží/přepíše záznam nebo pole záznamů (JSON v argumentu nebo na stdin)
 *   node pc/db.mjs smaz tabulky|udalosti <id>
 *
 * Přihlášení: token od pc/most.mjs (SLAVE_TOKEN), jinak e-mail a heslo z pc/.env.
 * Formát dat: pc/navod.md.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [join(KOREN, ".env.local"), join(KOREN, "pc", ".env")]) if (existsSync(f)) process.loadEnvFile(f);

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KLIC = process.env.SUPABASE_KLIC || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Přihlášený klient. Se `token` bez přihlašování (most předává svůj, ať se neplýtvá limitem přihlášení).
 * `obnovovat`: obnovovat token na pozadí (dlouho běžící most) - časovač drží proces naživu, CLI ho nechce.
 */
export async function prihlas(token = process.env.SLAVE_TOKEN, obnovovat = false) {
  if (!URL || !KLIC) throw new Error("Chybí SUPABASE_URL / klíč (.env.local nebo pc/.env).");
  const auth = { persistSession: false, autoRefreshToken: obnovovat };
  if (token) return createClient(URL, KLIC, { auth, global: { headers: { Authorization: `Bearer ${token}` } } });
  const sb = createClient(URL, KLIC, { auth });
  const { error } = await sb.auth.signInWithPassword({ email: process.env.SLAVE_EMAIL ?? "", password: process.env.SLAVE_HESLO ?? "" });
  if (error) throw new Error(`Přihlášení do Supabase: ${error.message} (SLAVE_EMAIL / SLAVE_HESLO v pc/.env)`);
  return sb;
}

const SLOUPCE = {
  tabulky: { seznam: "id,nazev,upraveno,listy", vse: "id,nazev,listy,upraveno" },
  udalosti: { seznam: "id,nazev,od,do,cely_den,cas_od,cas_do,misto,poznamka", vse: "id,nazev,od,do,cely_den,cas_od,cas_do,misto,poznamka" },
};

const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Doplní, co appka vyžaduje; zbytek ohlídají CHECKy v databázi a appka při načtení. */
function priprav(kolekce, x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("Záznam musí být JSON objekt.");
  const { user_id: _, ...r } = x;
  r.id ||= noveId();
  if (kolekce === "tabulky") {
    if (!Array.isArray(r.listy) || r.listy.length === 0) r.listy = [{ id: noveId(), nazev: "List1", bunky: {} }];
    for (const l of r.listy) {
      l.id ||= noveId();
      l.bunky ??= {};
      for (const k of Object.keys(l.bunky)) {
        if (!/^\d+,\d+$/.test(k)) throw new Error(`Špatný klíč buňky "${k}" - má být "řádek,sloupec" od nuly.`);
        l.bunky[k] = String(l.bunky[k]);
        if (l.bunky[k] === "") delete l.bunky[k];
      }
    }
    r.upraveno = new Date().toISOString();
  } else {
    r.do ||= r.od;
    r.cely_den ??= !r.cas_od;
  }
  return r;
}

async function stdin() {
  let s = "";
  for await (const c of process.stdin) s += c;
  return s;
}

async function main([prikaz, kolekce, arg]) {
  if (!SLOUPCE[kolekce]) throw new Error("Použití: node pc/db.mjs seznam|ukaz|uloz|smaz tabulky|udalosti [id|json]");
  const sb = await prihlas();
  const ven = (x) => console.log(JSON.stringify(x, null, 1));
  const chyba = (e) => {
    if (e) throw new Error(e.message);
  };

  if (prikaz === "seznam") {
    const { data, error } = await sb.from(kolekce).select(SLOUPCE[kolekce].seznam);
    chyba(error);
    if (kolekce === "tabulky") return ven(data.map((t) => ({ id: t.id, nazev: t.nazev, upraveno: t.upraveno, listy: t.listy.map((l) => l.nazev) })));
    return ven(data.sort((a, b) => (a.od + a.cas_od).localeCompare(b.od + b.cas_od)));
  }
  if (prikaz === "ukaz") {
    const { data, error } = await sb.from(kolekce).select(SLOUPCE[kolekce].vse).eq("id", arg).maybeSingle();
    chyba(error);
    if (!data) throw new Error(`${kolekce}/${arg} neexistuje.`);
    return ven(data);
  }
  if (prikaz === "uloz") {
    const vstup = JSON.parse(arg ?? (await stdin()));
    const radky = (Array.isArray(vstup) ? vstup : [vstup]).map((x) => priprav(kolekce, x));
    const { data, error } = await sb.from(kolekce).upsert(radky).select("id,nazev");
    chyba(error);
    return ven({ ulozeno: data });
  }
  if (prikaz === "smaz") {
    const { data, error } = await sb.from(kolekce).delete().eq("id", arg).select("id,nazev");
    chyba(error);
    return ven({ smazano: data });
  }
  throw new Error(`Neznámý příkaz "${prikaz}".`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`Chyba: ${e.message}`);
    process.exitCode = 1; // ne process.exit(): na Windows padá na zavírání handle (libuv assert)
  });
}
