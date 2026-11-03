/**
 * Protokol sidecaru Slave (FastAPI na PC, výchozí port 8765).
 *
 * HTTP s hlavičkou `x-agent-token`, WebSocket s `?token=`. Mobilní token smí
 * jen `/ws`, `/api/dashboard`, `/api/kalendar` a `/api/limity` - nic jiného
 * appka nevolá. Časy jsou unixové sekundy.
 */

export type StavUlohy = "bezi" | "ceka" | "preruseno" | "obnoveno" | "hotovo" | "chyba" | "zruseno";

export interface Uloha {
  id: number;
  projekt: string;
  ukol: string;
  stav: StavUlohy;
  start: number;
  konec: number | null;
  vysledek: string | null;
  chyba: string | null;
  nazev?: string | null;
  nastroj?: string | null;
  odlozeno?: string | null;
  odlozeno_kdy?: number | null;
}

export interface Pripominka {
  kdy: number;
  text: string;
}

export interface Dashboard {
  ulohy: Uloha[];
  plan?: unknown;
  pripominky: Pripominka[];
  system: { cpu: number; ram: number; disk_free_gb: number };
}

export interface Udalost {
  nazev: string;
  misto: string;
  kalendar: string;
  celodenni: boolean;
  uid: string;
  /** ISO; u celodenních jen `YYYY-MM-DD`. */
  zacatek: string;
  konec: string;
}

export interface Kalendar {
  nastaveno: boolean;
  udalosti: Udalost[];
  chyby: string[];
}

export const STAV_POPISEK: Record<StavUlohy, string> = {
  bezi: "běží",
  ceka: "čeká na tebe",
  preruseno: "přerušeno",
  obnoveno: "obnoveno",
  hotovo: "hotovo",
  chyba: "chyba",
  zruseno: "zrušeno",
};

export type VoiceState = "off" | "sleeping" | "listening" | "thinking" | "speaking" | "waiting";

export const VOICE_POPISEK: Record<VoiceState, string> = {
  off: "Hlas na PC vypnutý",
  sleeping: "Spí",
  listening: "Poslouchá",
  thinking: "Přemýšlí",
  speaking: "Mluví",
  waiting: "Čeká na ano / ne",
};

/** Zpráva ze serveru, kterou appka zpracovává. Ostatní typy se zahazují. */
export type ServerMessage =
  | { type: "voice_state"; state: VoiceState; detail: string }
  | { type: "assistant_message"; text: string }
  | { type: "voice_transcript"; text: string }
  | { type: "error"; message: string };

const VOICE_STATES = new Set<string>(Object.keys(VOICE_POPISEK));

/** Rozbalí rámec z WebSocketu. Rozbitý JSON nebo neznámý typ = `null`. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== "string") return null;
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const text = typeof data.text === "string" ? data.text : "";
  switch (data.type) {
    case "voice_state":
      return typeof data.state === "string" && VOICE_STATES.has(data.state)
        ? { type: "voice_state", state: data.state as VoiceState, detail: typeof data.detail === "string" ? data.detail : "" }
        : null;
    case "assistant_message":
    case "voice_transcript":
      return text.trim() ? { type: data.type, text } : null;
    case "error": {
      const message = [data.message, data.error].find((v) => typeof v === "string" && v.trim());
      return { type: "error", message: (message as string | undefined) ?? "Neznámá chyba na PC." };
    }
    default:
      return null;
  }
}

export const OFFLINE_HINT = "PC je vypnuté nebo není na stejné síti / v Tailscale.";

/**
 * Česká hláška k nepovedenému požadavku.
 *
 * `status` je HTTP kód, `null` = na PC se vůbec nedovolalo (vypnuté,
 * jiná síť, firewall, sidecar neposlouchá na síti). Sidecar vrací 403 i na
 * špatný token z telefonu, takže 403 musí zmínit obojí.
 */
export function describeFailure(status: number | null): string {
  if (status === null) return OFFLINE_HINT;
  if (status === 401) return "Špatný mobilní token. Opiš ho znovu z Nastavení Slave na PC.";
  if (status === 403) {
    return "PC přístup odmítlo. Zkontroluj mobilní token a že je ve Slave zapnutý přístup z telefonu.";
  }
  if (status === 404) return "Na téhle adrese neběží Slave, nebo je moc starý (chybí mobilní API).";
  return `PC odpovědělo chybou ${status}.`;
}
