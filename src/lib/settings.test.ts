import { describe, expect, it } from "vitest";
import { formatToken, httpUrl, isConfigured, normalizeToken, parseHost, wsUrl, DEFAULT_SETTINGS } from "./settings";

describe("normalizeToken", () => {
  it("zahodí pomlčky a mezery a převede na velká písmena", () => {
    expect(normalizeToken("abcd-efgh ijkl-2345")).toBe("ABCDEFGHIJKL2345");
    expect(normalizeToken("  ab cd\n")).toBe("ABCD");
  });

  it("zahodí i tečky a jiné znaky z automatické opravy klávesnice", () => {
    expect(normalizeToken("ABCD–EFGH.")).toBe("ABCDEFGH");
  });

  it("formát po čtyřech jde tam i zpátky", () => {
    const token = "ABCDEFGHIJKLMNOPQRSTUVWX";
    expect(formatToken(token)).toBe("ABCD-EFGH-IJKL-MNOP-QRST-UVWX");
    expect(normalizeToken(formatToken(token))).toBe(token);
    expect(formatToken("")).toBe("");
  });
});

describe("parseHost", () => {
  it("bere holé jméno i IP", () => {
    expect(parseHost("192.168.1.20")).toEqual({ host: "192.168.1.20", port: null });
    expect(parseHost(" muj-pc ")).toEqual({ host: "muj-pc", port: null });
  });

  it("odřízne schéma, cestu a vytáhne port", () => {
    expect(parseHost("http://192.168.1.20:9000/")).toEqual({ host: "192.168.1.20", port: 9000 });
    expect(parseHost("muj-pc.tail1234.ts.net:8765/api")).toEqual({ host: "muj-pc.tail1234.ts.net", port: 8765 });
  });

  it("zvládne IPv6 v závorkách", () => {
    expect(parseHost("[fd7a:115c::1]:8765")).toEqual({ host: "fd7a:115c::1", port: 8765 });
  });
});

describe("URL", () => {
  const s = { host: "192.168.1.20", port: 8765, token: "AB+CD" };

  it("HTTP adresa API", () => {
    expect(httpUrl(s, "/api/dashboard")).toBe("http://192.168.1.20:8765/api/dashboard");
  });

  it("WebSocket nese token v query a je zakódovaný", () => {
    expect(wsUrl(s)).toBe("ws://192.168.1.20:8765/ws?token=AB%2BCD");
  });

  it("IPv6 dostane hranaté závorky", () => {
    expect(httpUrl({ host: "fd7a::1", port: 8765 }, "/x")).toBe("http://[fd7a::1]:8765/x");
  });
});

describe("isConfigured", () => {
  it("chce adresu, token i platný port", () => {
    expect(isConfigured(DEFAULT_SETTINGS)).toBe(false);
    expect(isConfigured({ ...DEFAULT_SETTINGS, host: "pc", token: "AAAA" })).toBe(true);
    expect(isConfigured({ ...DEFAULT_SETTINGS, host: "pc", token: "AAAA", port: 70000 })).toBe(false);
  });
});
