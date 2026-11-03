#!/usr/bin/env node
/**
 * Most telefon → PC: čeká na příkazy z appky S/_ave (tabulka `prikazy` v Supabase), každý provede
 * přes Claude Code (`claude -p`, smí jen `node pc/db.mjs`) a výsledek zapíše zpátky. Změny tabulek
 * a kalendáře telefon dostane sám synchronizací.
 *
 *   npm run most          (nechat běžet; Ctrl+C ukončí)
 *
 * Potřebuje pc/.env: SLAVE_EMAIL, SLAVE_HESLO (stejný účet jako v telefonu). Viz pc/.env.example.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prihlas } from "./db.mjs";

const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE =
  process.env.CLAUDE_EXE ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
const LIMIT_MS = 10 * 60_000;

const cas = () => new Date().toLocaleTimeString("cs-CZ");
const log = (...a) => console.log(cas(), ...a);

/** Claude Code s příkazem na stdin; vrací jeho odpověď. Smí jen nástroj pc/db.mjs. */
function claude(text, token) {
  return new Promise((ok, fail) => {
    const p = spawn(
      CLAUDE,
      ["-p", "--output-format", "text", "--append-system-prompt-file", join(KOREN, "pc", "navod.md"), "--allowedTools", "Bash(node pc/db.mjs:*)"],
      // AGENT_MEMORY_OFF: hook paměti projektu tu nemá co dělat; SLAVE_TOKEN: db.mjs se nepřihlašuje znovu.
      { cwd: KOREN, env: { ...process.env, AGENT_MEMORY_OFF: "1", SLAVE_TOKEN: token }, windowsHide: true },
    );
    let ven = "";
    let err = "";
    p.stdout.on("data", (d) => (ven += d));
    p.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => p.kill(), LIMIT_MS);
    p.on("error", (e) => (clearTimeout(t), fail(e)));
    p.on("close", (kod) => {
      clearTimeout(t);
      if (kod === 0) ok(ven.trim());
      else fail(new Error((err || ven).trim().slice(-2000) || `claude skončil s kódem ${kod}`));
    });
    p.stdin.end(text);
  });
}

async function main() {
  if (!existsSync(CLAUDE)) throw new Error(`Nenašel jsem Claude Code: ${CLAUDE} (nastav CLAUDE_EXE).`);
  const sb = await prihlas(null, true);
  let bezi = false;
  let znovu = false;

  // Bere příkazy po jednom, nejstarší první; "ceka" → "bezi" podmíněně, ať jeden příkaz nevezmou dva mosty.
  async function zpracuj() {
    if (bezi) return void (znovu = true);
    bezi = true;
    try {
      for (;;) {
        const { data: dalsi, error } = await sb.from("prikazy").select("id,text").eq("stav", "ceka").order("vytvoreno").limit(1);
        if (error) throw new Error(error.message);
        if (!dalsi.length) break;
        const { id, text } = dalsi[0];
        const { data: vzal } = await sb.from("prikazy").update({ stav: "bezi" }).eq("id", id).eq("stav", "ceka").select("id");
        if (!vzal?.length) continue;
        log("▶", text.slice(0, 120));
        const token = (await sb.auth.getSession()).data.session?.access_token ?? "";
        try {
          const odpoved = await claude(text, token);
          await sb.from("prikazy").update({ stav: "hotovo", vysledek: odpoved.slice(0, 8000) || "Hotovo." }).eq("id", id);
          log("✔", odpoved.slice(0, 200));
        } catch (e) {
          await sb.from("prikazy").update({ stav: "chyba", vysledek: String(e.message ?? e).slice(0, 8000) }).eq("id", id);
          log("✖", e.message ?? e);
        }
      }
    } catch (e) {
      log("Chyba fronty:", e.message ?? e);
    } finally {
      bezi = false;
      if (znovu) {
        znovu = false;
        void zpracuj();
      }
    }
  }

  // Příkaz, který zůstal "bezi" po pádu mostu, by visel navždy - vrátit do fronty.
  await sb.from("prikazy").update({ stav: "ceka" }).eq("stav", "bezi");

  sb.channel("most")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "prikazy" }, () => void zpracuj())
    .subscribe((s) => log("realtime:", s));
  setInterval(() => void zpracuj(), 60_000); // pojistka, kdyby realtime vypadl
  log("Most běží, čekám na příkazy z telefonu.");
  await zpracuj();
}

main().catch((e) => {
  console.error("Most nespuštěn:", e.message ?? e);
  process.exitCode = 1;
});
