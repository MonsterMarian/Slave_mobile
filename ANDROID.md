# S/_ave (Slave) jako Android appka

Appka běží v telefonu ze souborů v APK. Není to zástupce na web - nativní obal
(Capacitor) drží WebView, splash screen, ikonu, stavovou lištu, hardwarové
tlačítko Zpět, vibrace, rozpoznávání řeči a předčítání. Po síti mluví se Supabase
(po přihlášení) a s GitHubem (aktualizace). Přímé spojení se sidecarem Slave na PC
je v UI vypnuté.

Nativní kostra, build skripty a postupy jsou převzaté z MicroWins a mpL (to, co
mají obě společné). Tenhle soubor je pro toho, kdo appku staví a vydává.

## Co je kde

| Cesta | Co to je |
|---|---|
| `capacitor.config.ts` | ID appky (`cz.slave.mobil`), jméno, barvy, `androidScheme: "http"` |
| `android/` | nativní projekt (Gradle). Generuje ho Capacitor, ruční úpravy přežijí |
| `android/app/src/main/AndroidManifest.xml` | oprávnění (internet, mikrofon), cleartext, `<queries>` pro řeč, appka jen na výšku |
| `android/app/src/main/java/cz/slave/mobil/` | `MainActivity` (bez vlastních pluginů) |
| `android/app/src/main/res/` | ikony, splash, barvy a témata |
| `scripts/android-assets.mjs` | generátor ikon, splashe a loga v appce z `assets/logo_mark.svg` |
| `scripts/gradle.mjs` | spustí Gradle s JDK z `gradle.properties` a obchvatem unixových socketů |
| `scripts/release.mjs` | postaví web s číslem verze a OTA balík |
| `scripts/sign-apk.mjs` | podepíše release APK klíčem z `android/keystore.properties` |
| `src/lib/native.ts` | most do nativní vrstvy (haptika, lišta, splash, tlačítko Zpět) |
| `src/lib/voice.ts` | diktování (`@capacitor-community/speech-recognition`) a předčítání (`@capacitor-community/text-to-speech`), obojí `cs-CZ` |
| `src/lib/udalosti.ts`, `tabulky.ts`, `vzorce.ts`, `uloziste.ts` | kalendář, tabulky, vzorce, ukládání do localStorage |
| `src/lib/settings.ts`, `api.ts`, `socket.ts`, `protocol.ts` | spárování, HTTP API a WebSocket sidecaru (v UI vypnuté) |
| `src/lib/live-update.ts` | živé aktualizace (OTA) z GitHubu, viz níž |
| `src/lib/sync.ts`, `supabase/schema.sql` | synchronizace přes Supabase a její schéma |
| `pc/most.mjs`, `pc/db.mjs` | fronta příkazů na PC a přístup k datům |
| `out/` | statický export webu, který se do APK kopíruje |

## Nástroje na tomhle počítači

Nic z toho není nainstalované v systému - leží to vedle sebe v `C:\Android`
a build si na to sáhne sám.

- Android SDK: `C:\Android\sdk`, ADB: `C:\Android\sdk\platform-tools\adb.exe`
  - cesta je v `android/local.properties` **lomítky dopředu** -
    `sdk.dir=C:\Android\sdk` se v Java properties přečte jako `C:Androidsdk`.
    Soubor je mimo git, v čerstvém klonu ho dopiš:

    ```
    sdk.dir=C:/Android/sdk
    ```
- JDK 21: `C:\Android\jdk\jdk-21.0.12+8`
  - Capacitor 8 se kompiluje na Javu 21; build si vlastní JDK bere přes
    `org.gradle.java.home` v `android/gradle.properties`
- Unixové sockety v `%LOCALAPPDATA%\Temp` tu bezpečnostní filtr zahazuje
  a Gradle pak padá na „Unable to establish loopback connection".
  `scripts/gradle.mjs` proto nastaví `-Djdk.net.unixdomain.tmpdir=C:/Android/gradle-tmp`
  (řešení z MicroWins). mpL má na totéž javového agenta `uds-off`; tady
  zatím nebyl potřeba.

## Sestavení APK

```bash
npm run android:apk
```

Postaví web s číslem verze, zkopíruje ho do `android/` (`cap sync`) a pustí
Gradle. Výsledek je `android/app/build/outputs/apk/debug/app-debug.apk`,
podepsaný debug klíčem tohohle počítače (`%USERPROFILE%\.android\debug.keystore`).

Release verze je `Slave.apk` v kořeni (`npm run android:release`, podpis
v1 + v2 + v3, viz *Podpisový klíč*). **Do telefonu dávej jen jednu z nich** -
debug a release mají jiný klíč a jedna přes druhou se nenainstaluje bez
odinstalace. Doporučeně release.

Build na Windows někdy zamrzne (antivirus, přejmenování složky v mezipaměti
Gradlu). Když se log přes pár minut nehne, zabij Gradle
(`taskkill /F /IM java.exe` - pozor, zabije i jiné Javy) a pusť build znovu.

`versionCode` jsou minuty od epochy a `versionName` časové razítko buildu
(`android/app/build.gradle`) - každý build je novější než předchozí, takže ho
Android vezme jako aktualizaci a nechá data (spárování) být.

## Instalace do telefonu

Přes kabel, když je v telefonu zapnuté ladění USB:

```bash
C:\Android\sdk\platform-tools\adb.exe install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Bez kabelu: APK zkopírovat do telefonu a otevřít ho tam. Android se zeptá na
povolení instalovat z tohoto zdroje - jednorázově potvrď. Play Protect hlásí
„Neznámá aplikace" - *Další podrobnosti → Přesto nainstalovat*.

## Synchronizace a příkazy

`.env.local` s adresou a publishable klíčem Supabase je mimo git, build je ale
zapéká do OTA balíku, takže jsou na GitHubu veřejné. Publishable klíč je k tomu
určený, data hlídá RLS a přihlášení. Do `.env.local` proto nikdy nepatří
`service_role` klíč. Příkazy z telefonu zpracovává na PC `npm run most`, viz README.

## Přímé spojení s PC (v UI vypnuté od 2026-11-03)

Platí, až se přímé spojení vrátí; teď appka na sidecar nesahá.


- Na PC: Slave → Nastavení → Telefon → *Povolit přístup z telefonu*, restart
  Slave (sidecar pak poslouchá na `0.0.0.0`). Windows se zeptá na firewall -
  povol jen soukromé sítě.
- Do appky opiš adresu, port a token. Token je base32 ve skupinách
  `XXXX-XXXX-…`; appka zahodí pomlčky a mezery a převede ho na velká písmena.
- **Origin.** WebView appky běží na `http://localhost`: `server.androidScheme:
  "http"` v `capacitor.config.ts`, hostname zůstává výchozí `localhost`
  (ověřeno v `@capacitor/android` 8.6.0, `Bridge.java`: `localUrl = scheme +
  "://" + host`). `CapacitorHttp` je vypnutý (výchozí), takže `fetch` i
  WebSocket jdou přes WebView a posílají `Origin: http://localhost` - přesně
  ten, který sidecar pouští (`mobil.ORIGIN`).
- **Cleartext.** Sidecar je v LAN na obyčejném `http://` / `ws://`, proto
  `android:usesCleartextTraffic="true"` v manifestu. Mimo domov používej
  Tailscale (šifruje); na cizí Wi-Fi přístup nezapínej.
- HTTP požadavky nesou hlavičku `x-agent-token`, takže prohlížeč nejdřív pošle
  preflight `OPTIONS` - odbavuje ho `CORSMiddleware` sidecaru.
- Mobilní token smí jen `/ws`, `/api/dashboard`, `/api/kalendar`,
  `/api/limity`. Appka nic jiného nevolá.

**Pozor na data:** `localStorage` (spárování, téma) patří k originu. Změna
`androidScheme` nebo `hostname` by uložené spárování schovala - uživatel by
token opisoval znovu.

## Živé aktualizace (OTA) z GitHubu

Mechanismus je stejný jako v MicroWins a mpL (`src/lib/live-update.ts`,
záchranný skript v `src/app/layout.tsx`, `scripts/release.mjs`). Repo
<https://github.com/MonsterMarian/Slave_mobile> je veřejné, takže appka čte
manifest bez přihlášení:

- manifest: `https://api.github.com/repos/MonsterMarian/Slave_mobile/contents/ota/latest.json?ref=main`
  (API kvůli čerstvosti; když selže, záloha přes `raw.githubusercontent.com`)
- balík: `https://raw.githubusercontent.com/MonsterMarian/Slave_mobile/main/ota/bundle-<verze>.json`

Appka při startu nasadí balík stažený minule a na pozadí se podívá po novějším.
Ručně: Nastavení (vpravo nahoře) → Aktualizace z GitHubu → *Zkontrolovat teď*
→ *Nasadit …* (nebo zavřít a otevřít appku).

**Vydání aktualizace webu** (změna v `src/`):

```bash
npm run ota:bundle        # postaví web s verzí, ota/latest.json + ota/bundle-<verze>.json
git add ota && git commit # (s ostatními změnami)
git push
```

`npm run android:release` dělá `ota:bundle` sám - po vydání APK stačí
commitnout a pushnout `ota/`, ať appka s tím APK vidí, že je aktuální.

**Kdy je potřeba nové APK:** změna nativní části - nový Capacitor plugin,
oprávnění v manifestu, ikona nebo splash, `targetSdk`, `capacitor.config.ts`.
To OTA nevymění.

## Změna ikony nebo splashe

Originál je `assets/logo_source.jpg` (oranžové oko z Gemini na tmavém,
nejednolitém pozadí). Z něj `npm run logo:source` udělá `assets/logo_mark.png`
s **průhledným** pozadím (alfa podle jasu, ořez kolem značky) a přebarví ho do
S/_ave modré (jas → modrý přechod `PRECHOD` ve skriptu). Výměna loga:

```bash
# nový obrázek do assets/logo_source.jpg
npm run logo:source
npm run android:assets
```

Ikona a splash jsou nativní - po změně je potřeba nové APK, OTA nestačí.

Vygeneruje ikony pro launcher (adaptivní i monochromatickou vrstvu pro
tématické ikony na Androidu 13+), splash ve všech hustotách a `src/lib/logo-image.ts`
(logo jako data URI; od 2026-11-03 ho UI nepoužívá - hlavička má wordmark S/_ave).
Pozadí ikony i splashe je obsidián `#09090B`, stejný jako `--background`
v tmavém režimu a `capacitor.config.ts` - jinak by mezi splashem a appkou bliklo.

## Podpisový klíč

Debug APK je podepsané debug klíčem tohohle počítače
(`%USERPROFILE%\.android\debug.keystore`). **Ten soubor zálohuj** - Android
považuje appku podepsanou jiným klíčem za jinou appku a aktualizace by šla
jen odinstalací (spárování by se ztratilo).

Release (`npm run android:release`) potřebuje vlastní klíč, který v gitu
**není a nesmí být** (`*.jks`, `android/keystore.properties` jsou v
`.gitignore`).

Na tomhle počítači klíč **už je** (založený 3. 11. 2026): `android/slave.jks`,
alias `slave`, náhodné heslo jen v `android/keystore.properties`. Certifikát
SHA-256 `13a6903999e6ef36bc1dfc2200a243966ff96b24910022dc5e80124eda67914f`.
**Oba soubory zálohuj mimo repo** (např. do správce hesel) - bez nich nejde
vydat aktualizaci release verze, jen odinstalovat a spárovat znovu.

Založení na jiném počítači (nový klíč = jiná appka pro Android):

```bash
C:\Android\jdk\jdk-21.0.12+8\bin\keytool.exe -genkeypair -v -keystore android/slave.jks -alias slave -keyalg RSA -keysize 2048 -validity 10000
```

a `android/keystore.properties`:

```
storeFile=slave.jks
storePassword=<heslo>
keyAlias=slave
keyPassword=<heslo>
```

Výsledek `npm run android:release` je podepsaný `Slave.apk` v kořeni (mimo
git - APK patří do GitHub Releases). Přechod z debug na release klíč znamená
v telefonu odinstalaci a nové spárování.

## Pozor při vývoji

- Jediná stránka, záložky jsou stav (`app-shell.tsx`). Tabulky se ukládají
  400 ms po změně a hned při odchodu appky na pozadí (`tabulky-view.tsx`).
- Každá změna webu se do appky dostane až přes `cap sync android`.
  Samotný `next build` na APK nesáhne.
- `npm run build` za běhu dev serveru rozbije dev appku v prohlížeči -
  server napřed zastav.
- Pluginy předčítání se registrují přes `registerPlugin` (jako v mpL):
  `@capacitor-community/text-to-speech` při importu sahá na `window` a shodil
  by prerender.
- Appka je jen na výšku (`screenOrientation="portrait"` v manifestu).
