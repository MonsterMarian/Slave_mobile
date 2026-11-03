"use client";

import * as React from "react";
import { fetchDashboard, SlaveError } from "@/lib/api";
import { OFFLINE_HINT, type ServerMessage, type VoiceState } from "@/lib/protocol";
import { DEFAULT_SETTINGS, isConfigured, loadSettings, saveSettings, wsUrl, type Settings } from "@/lib/settings";
import { SlaveSocket } from "@/lib/socket";
import { speak, stopSpeaking } from "@/lib/voice";

export type Status = "nenastaveno" | "pripojuji" | "pripojeno" | "odpojeno";

export interface ChatMessage {
  id: number;
  /** `ja` = napsáno / nadiktováno v telefonu, `pc` = přepis z mikrofonu u PC. */
  from: "ja" | "pc" | "slave" | "chyba";
  text: string;
  at: number;
}

interface SlaveApi {
  hydrated: boolean;
  settings: Settings;
  setSettings: (s: Settings) => void;
  status: Status;
  /** Proč spojení nejde - česky, rovnou k zobrazení. */
  problem: string | null;
  voiceState: VoiceState | null;
  voiceDetail: string;
  messages: ChatMessage[];
  /** `false` = spojení teď není, zpráva neodešla. */
  sendText: (text: string) => boolean;
  stop: () => void;
}

const SlaveContext = React.createContext<SlaveApi | null>(null);

export function useSlave(): SlaveApi {
  const ctx = React.useContext(SlaveContext);
  if (!ctx) throw new Error("useSlave musí být uvnitř SlaveProvider");
  return ctx;
}

// Chat se neukládá; po restartu appky začíná prázdný. Strop jen proti nafouknutí paměti.
const MAX_MESSAGES = 200;

export function SlaveProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = React.useState(false);
  const [settings, setSettingsState] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = React.useState<Status>("nenastaveno");
  const [problem, setProblem] = React.useState<string | null>(null);
  const [voiceState, setVoiceState] = React.useState<VoiceState | null>(null);
  const [voiceDetail, setVoiceDetail] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const socket = React.useRef<SlaveSocket | null>(null);
  const nextId = React.useRef(1);
  const ttsOn = React.useRef(settings.tts);
  ttsOn.current = settings.tts;

  React.useEffect(() => {
    setSettingsState(loadSettings());
    setHydrated(true);
  }, []);

  const setSettings = React.useCallback((s: Settings) => {
    saveSettings(s);
    setSettingsState(s);
  }, []);

  const push = React.useCallback((from: ChatMessage["from"], text: string) => {
    const msg = { id: nextId.current++, from, text, at: Date.now() };
    setMessages((prev) => [...prev, msg].slice(-MAX_MESSAGES));
  }, []);

  const onMessage = React.useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "voice_state":
          setVoiceState(msg.state);
          setVoiceDetail(msg.detail);
          break;
        case "assistant_message":
          push("slave", msg.text);
          // Na pozadí nemluvit - člověk se na telefon nedívá a hlas by ho vyděsil.
          if (ttsOn.current && document.visibilityState === "visible") void speak(msg.text);
          break;
        case "voice_transcript":
          push("pc", msg.text);
          break;
        case "error":
          push("chyba", msg.message);
          break;
      }
    },
    [push],
  );

  const { host, port, token } = settings;
  React.useEffect(() => {
    if (!hydrated) return;
    const current = settings;
    if (!isConfigured(current)) {
      setStatus("nenastaveno");
      setProblem(null);
      return;
    }
    let alive = true;
    /*
     * Proč WebSocket nejde, se z JS nedá zjistit - prohlížeč u nepovedeného
     * spojení hlásí jen kód 1006. HTTP dotaz na totéž PC ale vrátí 401/403
     * nebo nic, a z toho se hláška složit dá.
     */
    const probe = () => {
      fetchDashboard(current).then(
        () => alive && setProblem("PC odpovídá, ale spojení pro rozhovor (WebSocket) se nepovedlo. Zkouším znovu."),
        (e: unknown) => alive && setProblem(e instanceof SlaveError ? e.message : OFFLINE_HINT),
      );
    };
    const sock = new SlaveSocket({
      url: wsUrl(current),
      onMessage,
      onStatus: (s, failures) => {
        if (!alive) return;
        if (s === "open") {
          setStatus("pripojeno");
          setProblem(null);
        } else if (s === "closed") {
          setStatus("odpojeno");
          setVoiceState(null);
          // Při každém výpadku by se PC zahltilo dotazy; stačí první a pak každý pátý.
          if (failures === 1 || failures % 5 === 0) probe();
        } else if (failures === 0) {
          setStatus("pripojuji");
        }
      },
    });
    socket.current = sock;
    const onVisible = () => {
      if (document.visibilityState === "visible") sock.retryNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      sock.close();
      if (socket.current === sock) socket.current = null;
    };
    // `settings` celé ne: přepnutí předčítání nemá trhat spojení.
  }, [hydrated, host, port, token, onMessage]);

  const sendText = React.useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return false;
      if (!socket.current?.send({ type: "voice_text", text: clean })) return false;
      // Server vlastní zprávu zpátky neposílá - do chatu jde hned.
      push("ja", clean);
      return true;
    },
    [push],
  );

  const stop = React.useCallback(() => {
    void stopSpeaking();
    socket.current?.send({ type: "stop" });
  }, []);

  const api = React.useMemo<SlaveApi>(
    () => ({ hydrated, settings, setSettings, status, problem, voiceState, voiceDetail, messages, sendText, stop }),
    [hydrated, settings, setSettings, status, problem, voiceState, voiceDetail, messages, sendText, stop],
  );

  return <SlaveContext.Provider value={api}>{children}</SlaveContext.Provider>;
}
