// shortcut: spojení s PC je v UI vypnuté (2026-11-03) — vrátit, až uživatel řekne
import { parseServerMessage, type ServerMessage } from "./protocol";
import { reconnectDelay } from "./reconnect";

export type SocketStatus = "connecting" | "open" | "closed";

interface WebSocketLike {
  readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface SocketOptions {
  url: string;
  onMessage: (msg: ServerMessage) => void;
  /** `failures` = kolik pokusů za sebou se nepovedlo (0 po úspěšném spojení). */
  onStatus: (status: SocketStatus, failures: number) => void;
  /** Pro testy; v appce globální WebSocket z WebView. */
  create?: (url: string) => WebSocketLike;
}

const OPEN = 1;

/**
 * Trvalé spojení se sidecarem. Po výpadku se samo zkouší znovu s rostoucí
 * pauzou (`reconnectDelay`), dokud ho někdo nezavře přes `close()`.
 */
export class SlaveSocket {
  private ws: WebSocketLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private closed = false;

  constructor(private readonly opts: SocketOptions) {
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;
    this.opts.onStatus("connecting", this.failures);
    let ws: WebSocketLike;
    try {
      ws = this.opts.create ? this.opts.create(this.opts.url) : (new WebSocket(this.opts.url) as unknown as WebSocketLike);
    } catch {
      // Neplatná adresa: WebSocket hází hned v konstruktoru.
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.failures = 0;
      this.opts.onStatus("open", 0);
    };
    ws.onmessage = (ev) => {
      const msg = parseServerMessage(ev.data);
      if (msg) this.opts.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.scheduleRetry();
    };
    // onerror vždycky následuje onclose, tam se to vyřeší.
    ws.onerror = () => {};
  }

  private scheduleRetry(): void {
    if (this.closed) return;
    const delay = reconnectDelay(this.failures);
    this.failures += 1;
    this.opts.onStatus("closed", this.failures);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }

  /** Zkusit hned, bez čekání na pauzu - třeba po návratu appky do popředí. */
  retryNow(): void {
    if (this.closed || this.ws) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.connect();
  }

  get isOpen(): boolean {
    return this.ws?.readyState === OPEN;
  }

  /** `false` = spojení teď není, zpráva neodešla. */
  send(data: Record<string, unknown>): boolean {
    if (!this.ws || this.ws.readyState !== OPEN) return false;
    this.ws.send(JSON.stringify(data));
    return true;
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
