"use client";
// shortcut: spojení s PC je v UI vypnuté (2026-11-03) — vrátit, až uživatel řekne

import * as React from "react";
import { Check, Loader2, Mic, MicOff, Send, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSlave, type ChatMessage } from "@/components/providers/slave-provider";
import { tapFeedback } from "@/lib/native";
import { formatHodina } from "@/lib/kalendar";
import { listen, stopListening, stopSpeaking, VoiceError } from "@/lib/voice";
import { cn } from "@/lib/utils";

function Bubble({ msg }: { msg: ChatMessage }) {
  const mine = msg.from === "ja" || msg.from === "pc";
  return (
    <div className={cn("animate-in-up flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "select-text max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug",
          mine && "rounded-br-sm bg-secondary text-secondary-foreground",
          msg.from === "slave" && "rounded-bl-sm border bg-card text-card-foreground",
          msg.from === "chyba" && "rounded-bl-sm border border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        {msg.text}
      </div>
      <span className="tabular px-1 text-[11px] text-muted-foreground">
        {msg.from === "pc" ? "z mikrofonu u PC · " : ""}
        {formatHodina(new Date(msg.at))}
      </span>
    </div>
  );
}

export function ChatView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { status, problem, messages, voiceState, voiceDetail, sendText, stop } = useSlave();
  const [draft, setDraft] = React.useState("");
  const [listening, setListening] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const online = status === "pripojeno";

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, voiceState]);

  const send = (text: string) => {
    if (sendText(text)) {
      setLocalError(null);
      return true;
    }
    setLocalError("Zpráva neodešla - telefon teď není spojený s PC.");
    return false;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (send(draft)) setDraft("");
  };

  const answer = (text: "ano" | "ne") => {
    void tapFeedback();
    send(text);
  };

  const mic = async () => {
    void tapFeedback();
    if (listening) {
      await stopListening();
      return;
    }
    setLocalError(null);
    // Slave by jinak poslouchal sám sebe z reproduktoru.
    await stopSpeaking();
    setListening(true);
    try {
      const text = await listen();
      if (text) send(text);
    } catch (e) {
      setLocalError(e instanceof VoiceError ? e.message : `Diktování selhalo: ${String(e).slice(0, 120)}`);
    } finally {
      setListening(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {status === "nenastaveno" ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">Telefon ještě není spárovaný s PC.</p>
            <Button variant="brand" onClick={onOpenSettings}>
              Spárovat v Nastavení
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Napiš Slave, nebo klepni na mikrofon a mluv.
          </p>
        ) : null}
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
        </div>
        <div ref={endRef} />
      </div>

      {status === "odpojeno" || status === "pripojuji" ? (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
          <span>{status === "pripojuji" ? "Připojuji se k PC…" : (problem ?? "Spojení s PC spadlo, zkouším znovu…")}</span>
        </div>
      ) : null}

      {localError ? (
        <div className="mx-4 mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {localError}
        </div>
      ) : null}

      {voiceState === "waiting" && online ? (
        <div className="mx-4 mb-2 flex flex-col gap-2">
          {voiceDetail ? <p className="text-center text-sm text-muted-foreground">{voiceDetail}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="brand" className="h-14 text-lg" onClick={() => answer("ano")}>
              <Check className="!size-5" /> Ano
            </Button>
            <Button variant="outline" className="h-14 text-lg" onClick={() => answer("ne")}>
              <X className="!size-5" /> Ne
            </Button>
          </div>
        </div>
      ) : null}

      <form onSubmit={submit} className="flex items-end gap-2 border-t bg-background px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Zastavit"
          title="Zastavit (Slave přestane mluvit i pracovat na odpovědi)"
          onClick={stop}
          disabled={!online}
          className="size-11 shrink-0"
        >
          <Square className="!size-5" />
        </Button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter odešle, Shift+Enter nový řádek (s fyzickou klávesnicí).
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (send(draft)) setDraft("");
            }
          }}
          rows={1}
          placeholder={online ? "Napiš Slave…" : "Čekám na spojení s PC…"}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-card px-3.5 py-2.5 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {draft.trim() ? (
          <Button type="submit" variant="brand" size="icon" aria-label="Odeslat" className="size-11 shrink-0 rounded-full">
            <Send className="!size-5" />
          </Button>
        ) : (
          <Button
            variant={listening ? "destructive" : "brand"}
            size="icon"
            aria-label={listening ? "Přestat poslouchat" : "Diktovat"}
            onClick={() => void mic()}
            disabled={!online && !listening}
            className={cn("size-11 shrink-0 rounded-full", listening && "slave-pulse")}
          >
            {listening ? <MicOff className="!size-5" /> : <Mic className="!size-5" />}
          </Button>
        )}
      </form>
    </div>
  );
}
