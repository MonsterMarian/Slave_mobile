# Slave pro Android

Mobilní klient hlasového asistenta **Slave**, který běží na PC. Telefon se po
Wi-Fi nebo přes Tailscale připojí k sidecaru Slave (port 8765) a umí:

1. **Rozhovor** - psát Slave, nebo diktovat česky (rozpoznávání řeči Androidu).
   Odpovědi se předčítají i v telefonu (dá se vypnout). Když Slave čeká na
   potvrzení, objeví se velká tlačítka **Ano / Ne**. Tlačítko **Stop** ho zastaví.
2. **Přehled** - sezení (úlohy Claude Code a jejich stav), připomínky, kalendář
   na 7 dní a vytížení PC (CPU, RAM, volný disk). Obnovuje se po 5 s, dokud je
   appka v popředí.
3. **Nastavení** - spárování s PC (adresa, port, mobilní token z Nastavení
   Slave → Telefon), tlačítko *Vyzkoušet spojení*, předčítání, tmavý režim.

Bez spojení appka řekne proč (PC vypnuté / jiná síť / špatný token) a sama se
připojuje znovu s rostoucí pauzou.

---

## Spuštění

Pro lokální běh (v prohlížeči bez mikrofonu a předčítání):

```bash
npm install
npm run dev
```

Aplikace poběží na `http://localhost:3000`. Sidecar ale pouští jen Origin
`http://localhost` (bez portu), takže z dev serveru se k PC po síti
nepřipojí - spojení se ověřuje v APK. Stavba APK je v [`ANDROID.md`](ANDROID.md),
rozhodnutí a stav v [`NOTES.md`](NOTES.md).

## Technologie

- Next.js 15 (App Router, statický export)
- React 19
- TypeScript (strict mode)
- Tailwind CSS 4
- Vitest pro testování čisté logiky (token, adresy, kalendář, protokol, reconnect)
- Capacitor 8 (nativní Android appka)

Stejný základ jako appky MicroWins a mpL: `shadcn/ui` komponenty, ikony
`lucide-react`, tmavý i světlý režim, stejné build skripty a nativní kostra.
