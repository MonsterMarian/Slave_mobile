import { describe, expect, it } from "vitest";
import { sloucit, stabilni } from "./sync";

type X = { id: string; v: number };
const x = (id: string, v: number): X => ({ id, v });
const zaklad = (...xs: X[]) => Object.fromEntries(xs.map((i) => [i.id, stabilni(i)]));

describe("stabilni", () => {
  it("nezávisí na pořadí klíčů", () => {
    expect(stabilni({ b: 1, a: { d: [1, { f: 2, e: 3 }], c: "x" } })).toBe(stabilni({ a: { c: "x", d: [1, { e: 3, f: 2 }] }, b: 1 }));
  });
});

describe("sloucit", () => {
  it("první synchronizace: nic nesmaže, obě strany se sejdou", () => {
    const s = sloucit([x("a", 1)], [x("b", 2)], {});
    expect(s.vysledek).toEqual([x("a", 1), x("b", 2)]);
    expect(s.nahrat).toEqual([x("a", 1)]);
    expect(s.smazat).toEqual([]);
  });

  it("změna v telefonu se nahraje, změna z PC se převezme", () => {
    const b = zaklad(x("a", 1), x("b", 1));
    const s = sloucit([x("a", 2), x("b", 1)], [x("a", 1), x("b", 3)], b);
    expect(s.vysledek).toEqual([x("a", 2), x("b", 3)]);
    expect(s.nahrat).toEqual([x("a", 2)]);
  });

  it("změnili oba → vyhraje PC", () => {
    const s = sloucit([x("a", 2)], [x("a", 3)], zaklad(x("a", 1)));
    expect(s.vysledek).toEqual([x("a", 3)]);
    expect(s.nahrat).toEqual([]);
  });

  it("smazáno v telefonu → smaže se i v databázi", () => {
    const s = sloucit([], [x("a", 1)], zaklad(x("a", 1)));
    expect(s.vysledek).toEqual([]);
    expect(s.smazat).toEqual(["a"]);
  });

  it("smazáno na PC → zmizí z telefonu", () => {
    const s = sloucit([x("a", 1)], [], zaklad(x("a", 1)));
    expect(s.vysledek).toEqual([]);
    expect(s.nahrat).toEqual([]);
  });

  it("smazáno na jedné straně, upraveno na druhé → úprava přežije", () => {
    expect(sloucit([x("a", 2)], [], zaklad(x("a", 1))).nahrat).toEqual([x("a", 2)]);
    const s = sloucit([], [x("a", 2)], zaklad(x("a", 1)));
    expect(s.vysledek).toEqual([x("a", 2)]);
    expect(s.smazat).toEqual([]);
  });

  it("základ odpovídá výsledku - druhý běh už nic neposílá", () => {
    const s1 = sloucit([x("a", 1)], [x("b", 2)], {});
    const s2 = sloucit(s1.vysledek, [x("a", 1), x("b", 2)], s1.zaklad);
    expect(s2.nahrat).toEqual([]);
    expect(s2.smazat).toEqual([]);
    expect(s2.vysledek).toEqual(s1.vysledek);
  });
});
