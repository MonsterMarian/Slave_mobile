# AgentMEMORY — SlaveMobil (S/_ave)
Aktualizováno: 2026-11-03 18:52

## Cíl repa
Android appka Slave (Capacitor): Kalendář, Tabulky (mini Excel) a Příkaz pro PC. Data v localStorage
a synchronizovaná přes Supabase s PC (`pc/most.mjs` provádí příkazy z telefonu přes Claude Code). Dřív klient k PC (Rozhovor / Přehled / spárování) - kód zůstává, UI je vypnuté.

## Stav / jak spustit
- Next.js 15 static export + Capacitor 8, React 19, Tailwind 4, shadcn/ui (+ `@radix-ui/react-dialog`), lucide, vitest.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build`; APK `npm run android:release` → `Slave.apk` v kořeni.
- Repo: https://github.com/MonsterMarian/Slave_mobile (veřejné, remote `origin`, větev `main`). Po ověřeném commitu push.
- Vydání webu (OTA): `npm run ota:bundle` → commit `ota/` → push; appka si balík stáhne (Nastavení → Aktualizace).
  `android:release` dělá ota:bundle sám - po APK vždy commitnout a pushnout `ota/`.
  Nové APK jen při nativní změně (plugin, oprávnění, ikona/splash, capacitor.config).
- Telefon: Xiaomi `ace40f277d77`, `C:\Android\sdk\platform-tools\adb.exe -s ace40f277d77 install -r Slave.apk`.
- Kód: `src/components/kalendar-view.tsx`, `tabulky-view.tsx`, `ui/dialog.tsx`; logika `src/lib/udalosti.ts`,
  `tabulky.ts`, `uloziste.ts`, `vzorce.ts` (kopie z repa Slave) + testy `*.test.ts`.

## Supabase (od 2026-11-03)
- Projekt https://tvttqesgnzzrtfecrqjt.supabase.co; URL + publishable klíč v `.env.local` (gitignored, ale build je
  zapéká do OTA balíku → veřejné na GitHubu; publishable klíč je k tomu určený, data hlídá RLS + přihlášení).
- Schéma `supabase/schema.sql` (tabulky, udalosti, prikazy; RLS user_id = auth.uid(); realtime) - v projektu SPUŠTĚNO
  2026-11-03 (SQL Editor přes Chrome, monaco setValue). Účet uživatele: mar1anmoon@seznam.cz (registrace z appky,
  potvrzen SQL `update auth.users set email_confirmed_at`). „Confirm email“ VYPNUTO (uživatel nechce žádné e-maily),
  registrace zapnuté. Uživatel nechce dotazy na drobná nastavení - rovnou dělat.
- Telefon: `src/lib/sync.ts` tříbodové sloučení (místní / vzdálené / základ `slave:sync:<kolekce>`), při konfliktu vyhraje PC;
  běží po uložení, při startu, návratu do appky a na realtime. Přihlášení v Nastavení → Synchronizace s PC.
- PC: `npm run most` (pc/most.mjs) - fronta `prikazy` → `claude -p` s `pc/navod.md`, smí jen `Bash(node pc/db.mjs:*)`;
  účet v `pc/.env` (SLAVE_EMAIL, SLAVE_HESLO; vzor `pc/.env.example`). Ručně: `node pc/db.mjs seznam tabulky`.
- Past: v Node na Windows `process.exit()` se supabase klientem padá na libuv assert → `process.exitCode`.

## Hotovo
- 2026-11-03 — Tabulky: šířka sloupce podle textu (canvas measureText, 48–280 px) nebo ruční tažením úchytu v záhlaví
  (`List.sirky`, 48–600 px, dvojí ťuknutí = zpět podle textu); export .xlsx s `<cols>` a `_xlfn.` u CONCAT/TEXTJOIN/IFS/XLOOKUP.
  Vzorce rozšířené o ~45 funkcí (SUMIF(S), COUNTIF(S), VLOOKUP/XLOOKUP/INDEX/MATCH, IFERROR, textové…); chyba v argumentu
  je hodnota (IFERROR funguje). vzorce.ts se tím odchýlil od kopie v repu Slave. Nápověda funkcí (tlačítka pod
  řádkem vzorce, `napoveda()`). Ověřeno v Chromu (out/ přes python http.server): šířky, tažení, reset, COUNTIF.
- 2026-11-03 — Kalendář (měsíc od pondělí, události přidat/upravit/smazat, vícedenní, celodenní) a Tabulky
  (seznam, editor s listy, vzorce) offline; spojení s PC z UI pryč.

- 2026-11-03 — Nové logo (jantarové oko z Gemini): ikony, splash, hlavička.

- 2026-11-03 — Nastavení vpravo nahoře (ozubené kolo), OTA z GitHubu zapnuté (repo MonsterMarian/Slave_mobile).

- 2026-11-03 — Jméno S/_ave (wordmark v hlavičce bez loga, appName, strings.xml, title); jediný akcent S/_ave modrá; logo přebarvené do modré.

## Rozpracováno
- 2026-11-03 — export .xlsx (`src/lib/xlsx.ts`, bez knihovny, v telefonu do Dokumenty/S_ave přes Filesystem),
  mazání listu (koš v liště listů, jen když je jich víc), Zpět zavře otevřený dialog (`native.ts` zavriDialog).
  Testy 68/68, build, soubor ověřen v openpyxl; APK nainstalováno do telefonu, ale proklikání NEDOKONČENO
  (uživatel: „skipni mobilní apku"). Ověřit: export na telefonu (zápis do veřejných Dokumentů na Androidu 13+
  bez oprávnění?), Zpět u dialogu, smazání listu.

## Další kroky
- Ověřit na telefonu export, mazání listu a Zpět (viz Rozpracováno); virtualizace velké mřížky; import .xlsx.
- V localStorage telefonu zůstal mrtvý klíč `slave:accent` z testu výběru barev (nic ho nečte).

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

- 2026-11-03 — `OTA_RAW_BASE` v release.mjs je BEZ lomítka na konci (skript přidává `/bundle-…`).
- 2026-11-03 — Hláška „Máš nejnovější verzi" podle opravy mpL 5d58c02: když balík čeká, říká „stačí ji nasadit".

- 2026-11-03 — Jméno appky je **S/_ave** (firma slashunderscore), wordmark `S` + `/_` v akcentu + `ave`.
  Logo jen na ikoně a splashi, ne v hlavičce. Změna appName/strings.xml = nové APK.
- 2026-11-03 — Akcent: jen **S/_ave modrá** (tmavý #38BDF8 / text #09090B, světlý #0369A1 / bílý text) v
  `globals.css`; `src/lib/barvy.ts` + test hlídají WCAG ≥ 4,5 a shodu s CSS. Výběr 7 barev uživatel zrušil
  (kód v commitu c4af6d6). `--brand-muted` = color-mix 15 % do pozadí (neprůhledné kvůli sticky záhlaví).
- 2026-11-03 — Logo modré: `logo-from-source.mjs` mapuje jas na modrý přechod (`PRECHOD`), ne `modulate({hue})`
  (to dávalo tyrkysovou a zelenavé pozadí). Ikony/splash přes `npm run android:assets`.

## Log (posledních ~30)
- 2026-11-03 18:52 — „pokračuj“ → nápověda funkcí při psaní vzorce, vizuální kontrola v Chromu, OTA 2026.11.03.17.50.
- 2026-11-03 18:49 — „šířky sloupců podle textu / tažením + další Excel funkce“ → hotovo, 86 testů, OTA balík; na telefonu neověřeno (bez kabelu).
- 2026-11-03 17:48 — „hoď tam data“ → pc/.env, most spuštěný, příkaz z fronty → Claude založil tabulku Kontakty (id, jméno,
  telefonní číslo, status, web; jen záhlaví, NECHAT) za ~30 s. Ověřeno v DB; zobrazení v telefonu neověřeno (bez kabelu).
- 2026-11-03 17:46 — chyba při přihlášení = nepotvrzený e-mail → účet potvrzen SQL, Confirm email vypnut (na výslovný pokyn).
- 2026-11-03 17:35 — „hoď tam data“ → schéma spuštěno v Supabase; účet chybí → na přání uživatele registrace z appky, OTA balík.
- 2026-11-03 17:19 — příkazy z telefonu na PC přes Supabase + synchronizace tabulek/kalendáře → schéma, sync (8 testů), záložka
  Příkaz, Nastavení přihlášení, pc/most.mjs + db.mjs; OTA balík 2026.11.03.16.15. E2E NEOVĚŘENO: v Supabase chybí
  schéma a uživatel; tabulka Kontakty (id, jméno, telefon, status, web) se má založit příkazem z telefonu.
- 2026-11-03 11:08 — appka bez PC: Kalendář + Tabulky offline, testy a build zelené.
- 2026-11-03 11:11 — nové logo appky (oko z Gemini) přes skript, ikony a splash přegenerované.
- 2026-11-03 11:18 — Nastavení do hlavičky, OTA z GitHubu, remote origin, docs.
- 2026-11-03 11:27 — test na telefonu: kalendář, tabulky, force-stop OK; oprava: vybraná buňka se posune do zobrazení, české uvozovky; OTA balík 2026.11.03.10.26.
- 2026-11-03 11:37 — S/_ave wordmark, volba barvy akcentu (7 palet, WCAG test), docs/barvy.md, APK + OTA 2026.11.03.10.32.
- 2026-11-03 11:44 — jen modrá (výběr barev pryč), logo přebarvené do modré, APK + OTA 2026.11.03.10.40.
- 2026-11-03 11:47 — test na telefonu (APK 2026.11.03.10.40): ikona S/_ave, modrá v obou režimech, OTA „Máš nejnovější verzi"; testovací data smazána, appka na Kalendáři.
- 2026-11-03 13:54 — export .xlsx, mazání listu, Zpět zavře dialog; testy + build + openpyxl OK, APK + OTA 2026.11.03.12.51
  v telefonu, ruční test na telefonu přerušen na pokyn uživatele.
