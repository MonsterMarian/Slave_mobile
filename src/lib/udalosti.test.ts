import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  KALENDAR_KEY,
  klicDne,
  mrizkaMesice,
  nactiUdalosti,
  popisCasu,
  posunMesic,
  udalostiDne,
  ulozUdalosti,
  zkontroluj,
  type Udalost,
} from "./udalosti";
import { falesneUloziste } from "./test-uloziste";

const u = (p: Partial<Udalost>): Udalost => ({
  id: p.nazev ?? "x",
  nazev: "x",
  od: "2026-11-03",
  do: "2026-11-03",
  celyDen: false,
  casOd: "09:00",
  casDo: "10:00",
  misto: "",
  poznamka: "",
  ...p,
});

describe("mřížka měsíce", () => {
  it("začíná pondělím a končí nedělí", () => {
    const m = mrizkaMesice(2026, 10); // listopad 2026: 1. je neděle
    expect(klicDne(m[0])).toBe("2026-10-26");
    expect(m[0].getDay()).toBe(1);
    expect(m.at(-1)!.getDay()).toBe(0);
    expect(m.length).toBe(42);
    expect(klicDne(m.at(-1)!)).toBe("2026-12-06");
  });

  it("měsíc začínající pondělím nemá den navíc", () => {
    const m = mrizkaMesice(2027, 1); // únor 2027: 1. je pondělí, 28 dní
    expect(m.length).toBe(28);
    expect(klicDne(m[0])).toBe("2027-02-01");
  });

  it("přechod roku", () => {
    expect(posunMesic(2026, 11, 1)).toEqual({ rok: 2027, mesic: 0 });
    expect(posunMesic(2027, 0, -1)).toEqual({ rok: 2026, mesic: 11 });
    const m = mrizkaMesice(2027, 0); // leden 2027: 1. je pátek
    expect(klicDne(m[0])).toBe("2026-12-28");
  });

  it("přes změnu času nevynechá ani nezdvojí den", () => {
    const m = mrizkaMesice(2026, 2).map(klicDne); // březen 2026, 29. 3. letní čas
    expect(new Set(m).size).toBe(m.length);
    expect(m).toContain("2026-03-29");
    expect(m).toContain("2026-03-30");
  });
});

describe("události dne", () => {
  const vse = [
    u({ nazev: "Odpoledne", casOd: "14:00", casDo: "15:00" }),
    u({ nazev: "Ráno", casOd: "08:00", casDo: "" }),
    u({ nazev: "Dovolená", od: "2026-11-02", do: "2026-11-05", celyDen: true, casOd: "", casDo: "" }),
    u({ nazev: "Výjezd", od: "2026-11-01", do: "2026-11-03", casOd: "18:00", casDo: "12:00" }),
    u({ nazev: "Zítra", od: "2026-11-04", do: "2026-11-04" }),
  ];

  it("vícedenní a celodenní jsou v každém dni, do kterého zasahují", () => {
    expect(udalostiDne(vse, "2026-11-03").map((x) => x.nazev)).toEqual(["Dovolená", "Výjezd", "Ráno", "Odpoledne"]);
    expect(udalostiDne(vse, "2026-11-01").map((x) => x.nazev)).toEqual(["Výjezd"]);
    expect(udalostiDne(vse, "2026-11-05").map((x) => x.nazev)).toEqual(["Dovolená"]);
    expect(udalostiDne(vse, "2026-11-06")).toEqual([]);
  });

  it("popis času", () => {
    expect(popisCasu(vse[0])).toBe("14:00–15:00");
    expect(popisCasu(vse[1])).toBe("8:00");
    expect(popisCasu(vse[2])).toBe("2. 11. – 5. 11.");
    expect(popisCasu(vse[3])).toBe("1. 11. 18:00 – 3. 11. 12:00");
  });

  it("kontrola formuláře", () => {
    expect(zkontroluj(u({}))).toBeNull();
    expect(zkontroluj(u({ nazev: " " }))).toBe("Chybí název.");
    expect(zkontroluj(u({ do: "2026-11-01" }))).toBe("Konec je dřív než začátek.");
    expect(zkontroluj(u({ casOd: "11:00" }))).toBe("Konec je dřív než začátek.");
    expect(zkontroluj(u({ casOd: "" }))).not.toBeNull();
    expect(zkontroluj(u({ celyDen: true, casOd: "" }))).toBeNull();
  });
});

describe("úložiště kalendáře", () => {
  let m: Map<string, string>;
  beforeEach(() => {
    m = falesneUloziste();
  });

  it("uložit a načíst", () => {
    const data = [u({ nazev: "A", misto: "Praha", poznamka: "p" })];
    expect(ulozUdalosti(data)).toBe(true);
    expect(nactiUdalosti()).toEqual(data);
  });

  it("nic uloženého = prázdný kalendář", () => {
    expect(nactiUdalosti()).toEqual([]);
  });

  it("poškozený JSON appku neshodí a zůstane v záloze", () => {
    m.set(KALENDAR_KEY, "{nejde");
    expect(nactiUdalosti()).toEqual([]);
    expect(m.get(`${KALENDAR_KEY}:zaloha`)).toBe("{nejde");
  });

  it("vadné záznamy vypadnou, dobré zůstanou", () => {
    m.set(KALENDAR_KEY, JSON.stringify([null, 5, { id: "a" }, u({ nazev: "OK" }), { ...u({}), do: "nesmysl" }]));
    const x = nactiUdalosti();
    expect(x.map((e) => e.nazev)).toEqual(["OK", "x"]);
    expect(x[1].do).toBe(x[1].od);
  });

  it("úložiště, které hází, neshodí appku", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("zakázáno");
      },
      setItem: () => {
        throw new Error("plno");
      },
    });
    expect(nactiUdalosti()).toEqual([]);
    expect(ulozUdalosti([u({})])).toBe(false);
  });
});
