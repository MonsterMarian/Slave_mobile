import { describe, expect, it } from "vitest";
import { nazevDne, parseCas, poDnech } from "./kalendar";
import type { Udalost } from "./protocol";

const udalost = (nazev: string, zacatek: string, celodenni = false): Udalost => ({
  nazev,
  misto: "",
  kalendar: "Osobní",
  celodenni,
  uid: nazev,
  zacatek,
  konec: zacatek,
});

describe("parseCas", () => {
  it("celodenní datum je místní půlnoc, ne UTC", () => {
    const d = parseCas("2026-11-03");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 3, 0, 0]);
  });

  it("ISO s časem a zónou bere tak, jak je", () => {
    expect(parseCas("2026-11-03T09:30:00+01:00").getTime()).toBe(Date.UTC(2026, 10, 3, 8, 30));
  });
});

describe("nazevDne", () => {
  const now = new Date(2026, 10, 3, 15, 0); // úterý 3. 11. 2026

  it("dnes, zítra, jinak den v týdnu s datem", () => {
    expect(nazevDne(new Date(2026, 10, 3, 23, 59), now)).toBe("Dnes");
    expect(nazevDne(new Date(2026, 10, 4, 0, 0), now)).toBe("Zítra");
    expect(nazevDne(new Date(2026, 10, 5), now)).toBe("čtvrtek 5. 11.");
  });
});

describe("poDnech", () => {
  const now = new Date(2026, 10, 3, 8, 0);

  it("rozdělí po dnech popořadě, celodenní nahoru", () => {
    const dny = poDnech(
      [
        udalost("schůzka", new Date(2026, 10, 4, 10, 0).toISOString()),
        udalost("ráno", new Date(2026, 10, 3, 9, 0).toISOString()),
        udalost("svátek", "2026-11-04", true),
      ],
      now,
    );
    expect(dny.map((d) => d.nazev)).toEqual(["Dnes", "Zítra"]);
    expect(dny[1].udalosti.map((u) => u.nazev)).toEqual(["svátek", "schůzka"]);
  });

  it("celodenní dnešek se nepropadne do včerejška", () => {
    const dny = poDnech([udalost("dnes celý den", "2026-11-03", true)], now);
    expect(dny).toHaveLength(1);
    expect(dny[0].nazev).toBe("Dnes");
  });

  it("vícedenní, která začala dřív, ukáže pod dneškem; nesmysl zahodí", () => {
    const dny = poDnech([udalost("dovolená", "2026-11-01", true), udalost("rozbitá", "nesmysl")], now);
    expect(dny.map((d) => [d.nazev, d.udalosti.length])).toEqual([["Dnes", 1]]);
  });
});
