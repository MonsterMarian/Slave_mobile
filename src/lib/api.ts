// shortcut: spojení s PC je v UI vypnuté (2026-11-03) — vrátit, až uživatel řekne
import { describeFailure, type Dashboard, type Kalendar } from "./protocol";
import { httpUrl, type Settings } from "./settings";

/** Chyba s hláškou, kterou jde rovnou ukázat. `status: null` = PC nedostupné. */
export class SlaveError extends Error {
  constructor(public readonly status: number | null) {
    super(describeFailure(status));
  }
}

// Vypnuté PC v LAN neodpoví vůbec a fetch by visel desítky sekund.
const TIMEOUT_MS = 6000;

async function getJson<T>(s: Settings, path: string): Promise<T> {
  // AbortController místo AbortSignal.timeout: ten starší WebView nezná.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(httpUrl(s, path), {
      headers: { "x-agent-token": s.token },
      cache: "no-store",
      signal: abort.signal,
    });
  } catch {
    // Síťová chyba i zamítnutý CORS vypadají z JS stejně: TypeError bez detailu.
    throw new SlaveError(null);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new SlaveError(res.status);
  return (await res.json()) as T;
}

export function fetchDashboard(s: Settings): Promise<Dashboard> {
  return getJson<Dashboard>(s, "/api/dashboard");
}

export function fetchKalendar(s: Settings, dni = 7): Promise<Kalendar> {
  return getJson<Kalendar>(s, `/api/kalendar?dni=${dni}`);
}
