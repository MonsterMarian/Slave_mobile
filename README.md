# S/_ave pro Android

Appka Slave pro telefon. Funguje i bez spojení a bez účtu, data jsou v telefonu.
Po přihlášení se synchronizují přes Supabase s PC:

1. **Kalendář** - měsíc od pondělí, události s časem nebo celodenní, i vícedenní;
   přidat, upravit, smazat.
2. **Tabulky** - malý Excel: tabulky s listy, přes 50 funkcí ve vzorcích (`SUM`,
   `IF`, `VLOOKUP`, `XLOOKUP`, `SUMIF`…) s nápovědou při psaní, šířka sloupců podle
   textu i tažením, export do `.xlsx`, ukládá se samo.
3. **Taby** - otevřené taby z Kiwi (rozšíření `Slave/desktop-agent/kiwi-taby`);
   tab jde otevřít v telefonu nebo poslat na PC.
4. **Příkaz** - text z telefonu jde do fronty, vyřídí ho Slave na PC svými nástroji
   (BN, MW, kalendář a tabulky odsud, PC, Claude Code). Potřebuje přihlášení a běžící Slave.
5. **Nastavení** (ozubené kolo vpravo nahoře) - tmavý režim, aktualizace z GitHubu,
   přihlášení a synchronizace s PC.

Barva: S/_ave modrá, rozbor v [`docs/barvy.md`](docs/barvy.md).

Původní přímé spojení s PC (rozhovor, přehled, spárování) je v UI vypnuté; kód
zůstal (`shortcut:` komentáře) a vrátí se, až bude potřeba.

Repo: <https://github.com/MonsterMarian/Slave_mobile> (veřejné - odtud si appka
stahuje živé aktualizace, viz [`ANDROID.md`](ANDROID.md)).

---

## Spuštění

Pro lokální běh:

```bash
npm install
npm run dev
```

Aplikace poběží na `http://localhost:3000`. Stavba APK je v [`ANDROID.md`](ANDROID.md),
rozhodnutí a stav v [`NOTES.md`](NOTES.md).

Synchronizace jde přes Supabase projekt společný s MicroWins a BetterNotes (jeden účet
pro všechny appky). Adresa a publishable klíč jsou natvrdo v `src/lib/supabase.ts`,
schéma v [`supabase/schema.sql`](supabase/schema.sql).

## Příkazy z telefonu na PC

Vyřizuje je Slave (`desktop-agent/sidecar/tools/prikazy_telefon.py`), stačí, když běží
a je přihlášený k BN/MW (`python -m sidecar.tools.appky prihlasit`). Akce, které by Slave
hlasem potvrzoval, z telefonu projdou, nevratné ne a po cizím obsahu (web, poznámky) taky ne.

Starý most (jen tabulky a kalendář přes Claude Code) zůstal jako záloha, když Slave neběží.
Nespouštěj oba naráz - příkaz si vezme ten, kdo je rychlejší. Zkopíruj `pc/.env.example` jako `pc/.env`, doplň stejný účet jako v telefonu
a spusť most:

```bash
npm run most
```

Most bere příkazy z fronty a pouští `claude -p` s návodem `pc/navod.md`. Claude
smí spouštět jen `node pc/db.mjs`, který čte a mění tabulky a kalendář.

## Technologie

- Next.js 15 (App Router, statický export)
- React 19
- TypeScript (strict mode)
- Tailwind CSS 4
- Vitest pro testování čisté logiky (kalendář, tabulky a vzorce, úložiště, synchronizace, aktualizace)
- Capacitor 8 (nativní Android appka)
- Supabase (přihlášení, databáze, realtime)

Stejný základ jako appky MicroWins a mpL: `shadcn/ui` komponenty, ikony
`lucide-react`, tmavý i světlý režim, stejné build skripty a nativní kostra.
