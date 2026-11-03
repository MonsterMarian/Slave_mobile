// shortcut: spojení s PC je v UI vypnuté (2026-11-03) — vrátit, až uživatel řekne
/**
 * Spárování s PC: adresa sidecaru Slave, mobilní token a pár přepínačů.
 *
 * Ukládá se do `localStorage` jako v MicroWins a mpL - patří k originu
 * `http://localhost`, takže přežije aktualizaci appky i restart telefonu.
 * Odinstalace ho smaže a token je pak potřeba opsat znovu.
 */

export const DEFAULT_PORT = 8765;
const SETTINGS_KEY = "slave:settings";

export interface Settings {
  /** IP nebo jméno PC (`192.168.1.20`, `muj-pc` v Tailscale). Bez schématu a portu. */
  host: string;
  port: number;
  /** Mobilní token bez pomlček a mezer, velkými písmeny. */
  token: string;
  /** Odpovědi Slave předčítat i v telefonu. */
  tts: boolean;
}

export const DEFAULT_SETTINGS: Settings = { host: "", port: DEFAULT_PORT, token: "", tts: true };

/**
 * Token z Nastavení Slave na PC je base32 ve skupinách `XXXX-XXXX-…`.
 * Opisuje se ručně, takže se z něj zahodí všechno kromě písmen a číslic
 * (pomlčky, mezery, tečky z automatické opravy) a srovná se velikost.
 */
export function normalizeToken(input: string): string {
  return input.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

/** Zpátky do skupin po čtyřech, ať se dá porovnat s tím, co ukazuje PC. */
export function formatToken(token: string): string {
  return normalizeToken(token).match(/.{1,4}/g)?.join("-") ?? "";
}

/**
 * Adresa, jak ji člověk napíše: klidně s `http://`, s portem nebo
 * s lomítkem na konci. Vrací čisté jméno a port, pokud v ní byl.
 */
export function parseHost(input: string): { host: string; port: number | null } {
  let rest = input.trim().replace(/^[a-z]+:\/\//i, "");
  rest = rest.split(/[/?#]/)[0] ?? "";
  // IPv6 v hranatých závorkách: [fd7a::1]:8765
  const v6 = rest.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (v6) return { host: v6[1], port: v6[2] ? Number(v6[2]) : null };
  const withPort = rest.match(/^([^:]+):(\d+)$/);
  if (withPort) return { host: withPort[1], port: Number(withPort[2]) };
  return { host: rest, port: null };
}

export function validPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port < 65536;
}

function authority(s: Pick<Settings, "host" | "port">): string {
  const host = s.host.includes(":") ? `[${s.host}]` : s.host;
  return `${host}:${s.port}`;
}

/** `http://192.168.1.20:8765/api/dashboard` */
export function httpUrl(s: Pick<Settings, "host" | "port">, path: string): string {
  return `http://${authority(s)}${path}`;
}

/** `ws://192.168.1.20:8765/ws?token=…` - WebSocket z JS neumí vlastní hlavičky. */
export function wsUrl(s: Pick<Settings, "host" | "port" | "token">): string {
  return `ws://${authority(s)}/ws?token=${encodeURIComponent(s.token)}`;
}

export function isConfigured(s: Settings): boolean {
  return s.host.length > 0 && s.token.length > 0 && validPort(s.port);
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const data = JSON.parse(raw) as Partial<Settings>;
    return {
      host: typeof data.host === "string" ? data.host : "",
      port: typeof data.port === "number" && validPort(data.port) ? data.port : DEFAULT_PORT,
      token: typeof data.token === "string" ? normalizeToken(data.token) : "",
      tts: data.tts !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // soukromý režim - spárování vydrží do zavření appky
  }
}
