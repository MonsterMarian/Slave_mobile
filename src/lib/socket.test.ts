// shortcut: spojení s PC je v UI vypnuté (2026-11-03) — vrátit, až uživatel řekne
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconnectDelay, RECONNECT_MAX_MS } from "./reconnect";
import { SlaveSocket, type SocketStatus } from "./socket";

describe("reconnectDelay", () => {
  it("roste exponenciálně od sekundy", () => {
    expect([0, 1, 2, 3, 4].map((n) => reconnectDelay(n))).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it("má strop a nesmyslný vstup nespadne", () => {
    expect(reconnectDelay(5)).toBe(RECONNECT_MAX_MS);
    expect(reconnectDelay(1000)).toBe(RECONNECT_MAX_MS);
    expect(reconnectDelay(-1)).toBe(1000);
    expect(reconnectDelay(Number.NaN)).toBe(1000);
  });
});

class FakeWs {
  static all: FakeWs[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  constructor(public url: string) {
    FakeWs.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  fail() {
    this.readyState = 3;
    this.onerror?.({});
    this.onclose?.({});
  }
}

describe("SlaveSocket", () => {
  let statuses: [SocketStatus, number][];
  const make = () =>
    new SlaveSocket({
      url: "ws://pc:8765/ws?token=A",
      create: (url) => new FakeWs(url),
      onMessage: (m) => messages.push(m),
      onStatus: (s, f) => statuses.push([s, f]),
    });
  let messages: unknown[];

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWs.all = [];
    statuses = [];
    messages = [];
  });
  afterEach(() => vi.useRealTimers());

  it("po výpadku zkouší znovu s rostoucí pauzou a po úspěchu ji vynuluje", () => {
    const sock = make();
    FakeWs.all[0].fail();
    expect(FakeWs.all).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(FakeWs.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWs.all).toHaveLength(2);

    FakeWs.all[1].fail();
    vi.advanceTimersByTime(1999);
    expect(FakeWs.all).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWs.all).toHaveLength(3);

    FakeWs.all[2].open();
    expect(statuses.at(-1)).toEqual(["open", 0]);
    FakeWs.all[2].fail();
    vi.advanceTimersByTime(1000);
    expect(FakeWs.all).toHaveLength(4);
    sock.close();
  });

  it("posílá jen když je spojení otevřené a zprávy rozbalí", () => {
    const sock = make();
    expect(sock.send({ type: "stop" })).toBe(false);
    FakeWs.all[0].open();
    expect(sock.send({ type: "voice_text", text: "ano" })).toBe(true);
    expect(FakeWs.all[0].sent).toEqual(['{"type":"voice_text","text":"ano"}']);
    FakeWs.all[0].onmessage?.({ data: '{"type":"assistant_message","text":"Hotovo"}' });
    FakeWs.all[0].onmessage?.({ data: '{"type":"neco_jineho"}' });
    expect(messages).toEqual([{ type: "assistant_message", text: "Hotovo" }]);
    sock.close();
  });

  it("po close() už se znovu nepřipojuje", () => {
    const sock = make();
    sock.close();
    FakeWs.all[0].fail();
    vi.advanceTimersByTime(60_000);
    expect(FakeWs.all).toHaveLength(1);
  });

  it("retryNow nečeká na pauzu", () => {
    const sock = make();
    FakeWs.all[0].fail();
    sock.retryNow();
    expect(FakeWs.all).toHaveLength(2);
    vi.advanceTimersByTime(60_000);
    // Naplánovaný pokus se zrušil, žádné druhé spojení navíc.
    expect(FakeWs.all).toHaveLength(2);
    sock.close();
  });
});
