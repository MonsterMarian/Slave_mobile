import { vi } from "vitest";

/** localStorage pro testy - vitest tu běží v node bez prohlížeče. */
export function falesneUloziste() {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}
