/**
 * Akcent S/_ave: jedna barva, S/_ave modrá (rozbor v docs/barvy.md).
 *
 * Hodnoty se používají v `src/app/globals.css` (`--brand`, `--brand-foreground`);
 * tady jsou kvůli testu kontrastu (`barvy.test.ts` hlídá, že sedí s CSS a mají
 * WCAG AA ≥ 4,5:1 na pozadí, na kartě i pro text na tlačítku).
 */

export interface Varianta {
  akcent: string;
  /** text na plném akcentu (tlačítko) */
  text: string;
}

export const AKCENT: { tmava: Varianta; svetla: Varianta } = {
  tmava: { akcent: "#38BDF8", text: "#09090B" },
  svetla: { akcent: "#0369A1", text: "#FFFFFF" },
};

/** Povrchy appky, na kterých akcent stojí (globals.css: --background, --card). */
export const POVRCHY = {
  tmava: ["#09090B", "#18181B"],
  svetla: ["#FDFDFD", "#FFFFFF"],
};

function svetlost(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastní poměr WCAG 2.x (1 až 21). */
export function kontrast(a: string, b: string): number {
  const [x, y] = [svetlost(a), svetlost(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
