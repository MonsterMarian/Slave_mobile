# S/_ave pro Android

Appka Slave pro telefon. **Teď funguje bez PC** (rozhodnuto 2026-11-03), data jsou
jen v telefonu:

1. **Kalendář** - měsíc od pondělí, události s časem nebo celodenní, i vícedenní;
   přidat, upravit, smazat.
2. **Tabulky** - malý Excel: tabulky s listy, vzorce (`=SUM(A1:A3)`, `IF`,
   `AVERAGE`, `ROUND`…), ukládá se samo.
3. **Nastavení** (ozubené kolo vpravo nahoře) - tmavý režim, aktualizace z GitHubu.

Barva: S/_ave modrá, rozbor v [`docs/barvy.md`](docs/barvy.md).

Spojení s PC (rozhovor, přehled, spárování) je v UI vypnuté; kód zůstal
(`shortcut:` komentáře) a vrátí se, až bude potřeba.

Repo: <https://github.com/MonsterMarian/Slave_mobile> (veřejné - odtud si appka
stahuje živé aktualizace, viz [`ANDROID.md`](ANDROID.md)).

---

## Spuštění

Pro lokální běh (v prohlížeči bez mikrofonu a předčítání):

```bash
npm install
npm run dev
```

Aplikace poběží na `http://localhost:3000`. Stavba APK je v [`ANDROID.md`](ANDROID.md),
rozhodnutí a stav v [`NOTES.md`](NOTES.md).

## Technologie

- Next.js 15 (App Router, statický export)
- React 19
- TypeScript (strict mode)
- Tailwind CSS 4
- Vitest pro testování čisté logiky (kalendář, tabulky a vzorce, úložiště, aktualizace)
- Capacitor 8 (nativní Android appka)

Stejný základ jako appky MicroWins a mpL: `shadcn/ui` komponenty, ikony
`lucide-react`, tmavý i světlý režim, stejné build skripty a nativní kostra.
