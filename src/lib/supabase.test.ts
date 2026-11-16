import { describe, expect, it } from "vitest";
import { prejdiNaProjekt, SUPABASE_URL } from "./supabase";
import { falesneUloziste } from "./test-uloziste";

describe("prejdiNaProjekt", () => {
  it("po přechodu zahodí staré připojení, relaci i základ synchronizace, data nechá", () => {
    const m = falesneUloziste();
    m.set("slave:supabase", JSON.stringify({ url: "https://tvttqesgnzzrtfecrqjt.supabase.co", klic: "x" }));
    m.set("sb-tvttqesgnzzrtfecrqjt-auth-token", "{}");
    m.set("slave:sync:tabulky", "{}");
    m.set("slave:sync:udalosti", "{}");
    m.set("slave:tabulky", "[]");
    prejdiNaProjekt();
    expect([...m.keys()].sort()).toEqual(["slave:projekt", "slave:tabulky"]);
    expect(JSON.parse(m.get("slave:projekt")!)).toBe(SUPABASE_URL);
  });

  it("na novém projektu už nic nemaže", () => {
    const m = falesneUloziste();
    prejdiNaProjekt();
    m.set("slave:sync:tabulky", "{}");
    m.set("sb-mgxbvayypbrrbdzurgcj-auth-token", "{}");
    prejdiNaProjekt();
    expect(m.has("slave:sync:tabulky")).toBe(true);
    expect(m.has("sb-mgxbvayypbrrbdzurgcj-auth-token")).toBe(true);
  });
});
