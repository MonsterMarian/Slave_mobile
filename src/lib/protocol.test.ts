// shortcut: spojení s PC je v UI vypnuté (2026-11-03) — vrátit, až uživatel řekne
import { describe, expect, it } from "vitest";
import { describeFailure, OFFLINE_HINT, parseServerMessage } from "./protocol";

describe("parseServerMessage", () => {
  it("stav hlasu", () => {
    expect(parseServerMessage('{"type":"voice_state","state":"waiting","detail":"smazat?"}')).toEqual({
      type: "voice_state",
      state: "waiting",
      detail: "smazat?",
    });
  });

  it("neznámý stav hlasu zahodí", () => {
    expect(parseServerMessage('{"type":"voice_state","state":"dancing"}')).toBeNull();
  });

  it("odpověď a přepis z PC", () => {
    expect(parseServerMessage('{"type":"assistant_message","text":"Ahoj"}')).toEqual({ type: "assistant_message", text: "Ahoj" });
    expect(parseServerMessage('{"type":"voice_transcript","text":"co je dneska"}')).toEqual({
      type: "voice_transcript",
      text: "co je dneska",
    });
    expect(parseServerMessage('{"type":"assistant_message","text":"  "}')).toBeNull();
  });

  it("chyba bere message, pak error, jinak obecnou hlášku", () => {
    expect(parseServerMessage('{"type":"error","message":"A"}')).toEqual({ type: "error", message: "A" });
    expect(parseServerMessage('{"type":"error","error":"B"}')).toEqual({ type: "error", message: "B" });
    expect(parseServerMessage('{"type":"error"}')).toEqual({ type: "error", message: "Neznámá chyba na PC." });
  });

  it("ostatní typy a rozbitý JSON ignoruje", () => {
    expect(parseServerMessage('{"type":"dashboard_update"}')).toBeNull();
    expect(parseServerMessage("{rozbité")).toBeNull();
    expect(parseServerMessage("null")).toBeNull();
    expect(parseServerMessage(new ArrayBuffer(2))).toBeNull();
  });
});

describe("describeFailure", () => {
  it("bez odpovědi = PC vypnuté / jiná síť", () => {
    expect(describeFailure(null)).toBe(OFFLINE_HINT);
  });

  it("401 a 403 mluví o tokenu", () => {
    expect(describeFailure(401)).toMatch(/token/);
    expect(describeFailure(403)).toMatch(/token/);
    expect(describeFailure(500)).toMatch(/500/);
  });
});
