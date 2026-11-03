// shortcut: spojení s PC je v UI vypnuté (2026-11-03) — vrátit, až uživatel řekne
/**
 * Kdy zkusit WebSocket znovu.
 *
 * Exponenciálně 1 s, 2 s, 4 s … až po strop 30 s. Kratší strop by telefon
 * s vypnutým PC držel vzhůru a vybíjel baterii, delší by po zapnutí PC
 * nechal člověka čekat. Pokus 0 = první opakování po výpadku.
 */
export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30_000;

export function reconnectDelay(attempt: number, base = RECONNECT_BASE_MS, max = RECONNECT_MAX_MS): number {
  if (!Number.isFinite(attempt) || attempt < 0) return base;
  // Strop na exponent, ať 2 ** 1000 nedá Infinity.
  return Math.min(max, base * 2 ** Math.min(attempt, 20));
}
