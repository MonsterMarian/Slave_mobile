# AgentMEMORY — SlaveMobil
Aktualizováno: 2026-11-03 11:11

## Cíl repa
Android appka Slave (Capacitor). Teď (2026-11-03) **offline**: Kalendář a Tabulky (mini Excel),
data jen v telefonu. Dřív klient k PC (Rozhovor / Přehled / spárování) - kód zůstává, UI je vypnuté.

## Stav / jak spustit
- Next.js 15 static export + Capacitor 8, React 19, Tailwind 4, shadcn/ui (+ `@radix-ui/react-dialog`), lucide, vitest.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build`; APK `npm run android:release` → `Slave.apk` v kořeni.
- Telefon: Xiaomi `ace40f277d77`, `C:\Android\sdk\platform-tools\adb.exe -s ace40f277d77 install -r Slave.apk`.
- Kód: `src/components/kalendar-view.tsx`, `tabulky-view.tsx`, `ui/dialog.tsx`; logika `src/lib/udalosti.ts`,
  `tabulky.ts`, `uloziste.ts`, `vzorce.ts` (kopie z repa Slave) + testy `*.test.ts`.

## Hotovo
- 2026-11-03 — Kalendář (měsíc od pondělí, události přidat/upravit/smazat, vícedenní, celodenní) a Tabulky
  (seznam, editor s listy, vzorce) offline; spojení s PC z UI pryč.

- 2026-11-03 — Nové logo (jantarové oko z Gemini): ikony, splash, hlavička.

## Rozpracováno
- (nic)

## Další kroky
- Export .xlsx (chce knihovnu), virtualizace velké mřížky, mazání listu.

## Rozhodnutí a poznámky
- 2026-11-03 — Úložiště `localStorage` (`slave:kalendar`, `slave:tabulky`), stejně jako téma a spárování.
  Poškozený JSON appku neshodí, zkopíruje se do `<klíč>:zaloha`, ať ho další uložení nesmaže.
- 2026-11-03 — Buňka se píše rovnou do dat při každém znaku (žádný „draft"), ukládá se 400 ms po změně
  a hned při `visibilitychange: hidden` / `pagehide` - force-stop nic neztratí.
- 2026-11-03 — Kód spojení s PC (socket, api, settings, provider, chat, přehled) nemazat; má komentář
  `shortcut: spojení s PC je v UI vypnuté` - vrátit, až uživatel řekne.

- 2026-11-03 — Logo: originál `assets/logo_source.jpg` (tmavé nejednolité pozadí) → `npm run logo:source`
  (`scripts/logo-from-source.mjs`: alfa podle jasu, smoothstep 32..150, barva odmíchaná z černé, ořez na čtverec)
  → `assets/logo_mark.png` → `npm run android:assets` (ikony, splash, `src/lib/logo-image.ts`).
  Výměna loga = nový obrázek do `assets/logo_source.jpg` a ty dva příkazy; pak nové APK (ikona je nativní).
  Popředí adaptivní ikony se samo zmenší do bezpečné zóny 66 dp (vyšlo 59,5 % plátna).

## Log (posledních ~30)
- 2026-11-03 11:08 — appka bez PC: Kalendář + Tabulky offline, testy a build zelené.
- 2026-11-03 11:11 — nové logo appky (oko z Gemini) přes skript, ikony a splash přegenerované.
