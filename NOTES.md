# NOTES - kontext, rozhodnutí a co dál

Shrnutí vzniku aplikace a plán dalších kroků. Jeden soubor, ať se nemusí lovit v historii chatu.

---

## 0. Změna 2026-11-03: appka bez PC

Uživatel: „tu apku zatím udělej bez spojení s PC, zatím mi tam dej jen ten
excel a kalendář". Spodní lišta Kalendář / Tabulky, Nastavení vpravo nahoře.
Data jen v telefonu (`localStorage`: `slave:kalendar`, `slave:tabulky`).
Vzorce jsou kopie `vzorce.ts` z repa Slave (desktop dashboard). Rozhovor,
Přehled a spárování jsou z UI pryč, kód zůstal. Nové logo (oko) a OTA
z GitHubu (`MonsterMarian/Slave_mobile`) zapnuté. Sekce níž popisují
původní klient k PC.

## 1. Zadání

Mobilní klient **Slave** - hlasového asistenta, který běží na PC (repo `slave`,
sidecar FastAPI na portu 8765). Telefon se k PC připojí po Wi-Fi nebo přes
Tailscale a umí: rozhovor (psaní, diktování česky, předčítání odpovědí,
Ano / Ne na potvrzení, Stop), přehled (sezení Claude Code, připomínky, kalendář
na 7 dní, systém PC) a spárování (adresa + mobilní token).

Základ appky: **inspirovat se MicroWins a mpL a převzít to, co mají společné**.
Co je specifické pro jednu z nich, vynechat.

---

## 2. Co vzniklo

| Záložka | Obsah |
|---|---|
| Rozhovor | bubliny (já / přepis z mikrofonu u PC / Slave / chyba), pole na psaní, mikrofon, Stop, velká Ano / Ne při stavu `waiting`, hláška bez spojení |
| Přehled | CPU / RAM / volný disk, sezení se stavem, připomínky, kalendář po dnech; poll 5 s v popředí + ruční obnovení |
| Nastavení | adresa, port, mobilní token, *Uložit*, *Vyzkoušet spojení*, předčítání, tmavý režim, verze |

Stack: Next.js 15 (statický export) · React 19 · TypeScript strict · Tailwind 4 ·
shadcn/ui · lucide-react · Vitest · Capacitor 8.

### Převzato z MicroWins a mpL (společné)

- `package.json` skripty (`android:assets`, `ota:bundle`, `android:apk`,
  `android:release`, `android:sign`), `next.config.ts`, `tsconfig.json`,
  `vitest.config.ts`, `postcss.config.mjs`, `components.json` - beze změny
- `capacitor.config.ts` (splash, stavová lišta, `SystemBars` edge-to-edge)
- celá nativní kostra `android/`: `gradle.properties` s `org.gradle.java.home`,
  `variables.gradle` (minSdk 24, compileSdk 36, targetSdk 35), `build.gradle`
  s verzí z času buildu a podpisem v1+v2+v3, manifest jen na výšku, styly a barvy
- `scripts/gradle.mjs` (JDK z gradle.properties, obchvat unixových socketů),
  `scripts/android-assets.mjs` (ikony, splash, logo v appce), `scripts/release.mjs`,
  `scripts/sign-apk.mjs` (verze z mpL - sama si najde `JAVA_HOME`)
- `src/lib/native.ts`, `src/lib/live-update.ts` (+ test), `src/lib/theme.ts`,
  `src/lib/utils.ts`, záchranný skript OTA v `layout.tsx`
- UI: `button`, `card`, `badge`, `input`, `switch-pill`; tokeny `globals.css`
  (zinc, bezpečné zóny, 44px zásah pro prst, `animate-in-up`), tmavý i světlý režim
- předčítání registrované přes `registerPlugin` (mpL, `lib/speech.ts`)
- styl dokumentace: README / ANDROID / NOTES

### Vynecháno (specifické pro jednu appku)

- MicroWins: Supabase a účty, kalendářový plugin a `CalendarSyncWorker`
  (WorkManager), AI klíč (`@anthropic-ai/sdk`), sdílení, strom winů, projekty,
  time box, import dat, swipe navigace, bottom sheety, ikonový katalog
- mpL: přehrávač (ExoPlayer, libVLC, NewPipe, služby v popředí), PDF čtečka
  a fonty, stahování, `CrashLog`, background task, jitpack, `abiFilters`
- APK verzované v gitu (obě appky to dřív dělaly; tady `*.apk` v `.gitignore`)
- javový agent `uds-off` z mpL - stačilo řešení z MicroWins (`unixdomain.tmpdir`)

---

## 3. Rozhodnutí a proč

| Rozhodnutí | Proč |
|---|---|
| **Jedna stránka, záložky jako stav** | Spojení s PC (WebSocket) musí přežít přepnutí záložky. Routy by provider stejně musely držet nad sebou a statický export by přidal jen `index.html` navíc. |
| **`androidScheme: "http"`** | Sidecar je na čistém `http://` / `ws://` v LAN. Stránka z `https://localhost` (výchozí v Capacitoru 6+) by na něj nesměla (mixed content). Origin je pak `http://localhost` - ten sidecar pouští. |
| **Spárování v `localStorage`, ne Preferences** | Stejně jako MicroWins a mpL, žádný plugin navíc. Patří k originu, přežije aktualizaci i OTA. |
| **Token se normalizuje při ukládání** | Opisuje se z obrazovky PC: pomlčky, mezery, malá písmena a tečky z autokorekce se zahodí. V poli se pak ukáže zpátky po čtyřech. |
| **Proč spojení nejde, zjišťuje HTTP** | WebSocket z JS při neúspěchu hlásí jen kód 1006. Appka proto při prvním a pak každém pátém výpadku zkusí `/api/dashboard` a podle 401/403/nic složí hlášku. |
| **Reconnect 1 s, 2 s, 4 s … strop 30 s** | Kratší strop by s vypnutým PC vybíjel baterii, delší by po zapnutí PC nechal čekat. Po návratu appky do popředí se zkusí hned. |
| **403 mluví o tokenu i o originu** | Sidecar (`authguard.py`) vrací 403 i na špatný mobilní token, ne 401. |
| **Diktování bez okna a bez průběžných výsledků** | `popup: false, partialResults: false` - plugin vrátí rovnou hotovou větu, není co skládat z událostí. Ticho („No match") není chyba. |
| **Předčítání jen v popředí** | Odpověď, která dorazí, když je appka na pozadí, by člověka vyděsila. Je pořád v chatu. Mikrofon předčítání nejdřív utne, ať Slave neposlouchá sám sebe. |
| **Kalendář jen po minutě** | Události se mění zřídka a 5 s by zbytečně zatěžovalo PC. Sezení a systém jdou po 5 s, tlačítko obnovit načte všechno hned. |
| **Celodenní události jako místní půlnoc** | `new Date("2026-11-03")` je půlnoc UTC - v Praze 1:00, na západ od Greenwiche předchozí den. |
| **Chat se neukládá** | Historie rozhovoru žije na PC. Po restartu appky začíná prázdný. |
| **OTA vypnuté** | Appka zatím nemá vlastní repozitář s releasy. Postup zapnutí je v ANDROID.md. |

---

## 4. Co dál

- Ověřit na skutečném telefonu: spojení se sidecarem (LAN i Tailscale),
  preflight `OPTIONS` s `x-agent-token`, diktování česky, předčítání, Ano / Ne.
- Vlastní GitHub repo → zapnout OTA a vydávat APK přes Releases.
- Release klíč (`android/slave.jks`), dokud appku nemá nikdo jiný.
- `/api/limity` (sidecar ho mobilnímu tokenu povoluje) zatím appka nečte.
- Notifikace „Slave čeká na tebe", když je appka na pozadí - potřebovala by
  službu v popředí nebo push, obojí je nativní práce navíc.
