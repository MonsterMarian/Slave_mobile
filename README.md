# S/_ave pro Android

Appka Slave pro telefon. Funguje i bez spojení a bez účtu, data jsou v telefonu.
Po přihlášení se synchronizují přes Supabase s PC:

1. **Kalendář** - měsíc od pondělí, události s časem nebo celodenní, i vícedenní;
   přidat, upravit, smazat.
2. **Tabulky** - malý Excel: tabulky s listy, přes 50 funkcí ve vzorcích (`SUM`,
   `IF`, `VLOOKUP`, `XLOOKUP`, `SUMIF`…) s nápovědou při psaní, šířka sloupců podle
   textu i tažením, export do `.xlsx`, ukládá se samo.
3. **Příkaz** - text z telefonu jde do fronty, PC ho provede přes Claude Code
   a může měnit tabulky i kalendář. Potřebuje přihlášení a běžící most na PC.
4. **Nastavení** (ozubené kolo vpravo nahoře) - tmavý režim, aktualizace z GitHubu,
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

Synchronizace potřebuje v `.env.local` adresu a publishable klíč projektu Supabase
a v databázi schéma ze [`supabase/schema.sql`](supabase/schema.sql).

## Příkazy z telefonu na PC

Zkopíruj `pc/.env.example` jako `pc/.env`, doplň stejný účet jako v telefonu
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
