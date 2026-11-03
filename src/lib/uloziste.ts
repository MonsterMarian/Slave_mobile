/**
 * Data appky v telefonu: `localStorage` jako spárování a téma (patří k originu
 * `http://localhost`, přežije zavření appky, restart telefonu i aktualizaci;
 * smaže ho jen odinstalace nebo „Vymazat data").
 */

/** Uložený JSON, nebo null. Poškozený záznam appku neshodí - schová se do `<klíč>:zaloha`, ať ho přepis nesmaže. */
export function nactiJson(key: string): unknown {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    try {
      if (raw) localStorage.setItem(`${key}:zaloha`, raw);
    } catch {
      // není kam zálohovat - aspoň nespadnout
    }
    return null;
  }
}

/** false = neuloženo (plné úložiště, soukromý režim). */
export function ulozJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function noveId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const jeText = (v: unknown): v is string => typeof v === "string";
