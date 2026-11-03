"use client";

import * as React from "react";
import { LayoutDashboard, MessageCircle, Settings } from "lucide-react";
import { ChatView } from "@/components/chat-view";
import { OverviewView } from "@/components/overview-view";
import { SettingsView } from "@/components/settings-view";
import { useSlave, type Status } from "@/components/providers/slave-provider";
import { applyPendingUpdate, checkForUpdate, markBootSucceeded } from "@/lib/live-update";
import { logoImage } from "@/lib/logo-image";
import { hideSplash, isNative, registerBackButton, syncStatusBar } from "@/lib/native";
import { VOICE_POPISEK } from "@/lib/protocol";
import { cn } from "@/lib/utils";

type Tab = "chat" | "prehled" | "nastaveni";

const NAV: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "chat", label: "Rozhovor", icon: MessageCircle },
  { id: "prehled", label: "Přehled", icon: LayoutDashboard },
  { id: "nastaveni", label: "Nastavení", icon: Settings },
];

const STATUS_POPISEK: Record<Status, string> = {
  nenastaveno: "Nespárováno",
  pripojuji: "Připojuji…",
  pripojeno: "Připojeno",
  odpojeno: "Odpojeno",
};

/**
 * Nativní chování appky: schování splash screenu po prvním vykreslení,
 * stavová lišta podle tématu, živé aktualizace a hardwarové Zpět
 * (z vedlejší záložky na Rozhovor, z Rozhovoru ven). V prohlížeči nic.
 */
function useNativeShell(tab: Tab, setTab: (t: Tab) => void) {
  const current = React.useRef(tab);
  current.current = tab;

  React.useEffect(() => {
    void hideSplash();
    void syncStatusBar(document.documentElement.classList.contains("dark"));
    markBootSucceeded();
    void applyPendingUpdate().then((res) => {
      if (!res.applied) void checkForUpdate();
    });
  }, []);

  React.useEffect(() => {
    let cleanup = () => {};
    void registerBackButton(() => {
      if (current.current === "chat") return false;
      setTab("chat");
      return true;
    }).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup();
  }, [setTab]);
}

export function AppShell() {
  const { status, voiceState } = useSlave();
  const [tab, setTab] = React.useState<Tab>("chat");
  const [native, setNative] = React.useState(false);

  useNativeShell(tab, setTab);
  React.useEffect(() => setNative(isNative()), []);

  const active = voiceState === "listening" || voiceState === "speaking" || voiceState === "thinking";
  const subtitle = status === "pripojeno" && voiceState ? VOICE_POPISEK[voiceState] : STATUS_POPISEK[status];

  return (
    // h-dvh: chat má pole dole a seznam nad ním roluje sám, stránka ne.
    <div className={cn("flex h-dvh flex-col", native && "select-none")}>
      <header className="mw-safe-top mw-safe-x border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoImage} alt="" className={cn("size-8 object-contain", active && "slave-pulse")} />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">Slave</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  status === "pripojeno" ? "bg-brand" : status === "odpojeno" ? "bg-destructive" : "bg-muted-foreground",
                )}
              />
              {subtitle}
            </span>
          </div>
        </div>
      </header>

      <main className="mw-safe-x mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
        {tab === "chat" ? (
          <ChatView onOpenSettings={() => setTab("nastaveni")} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">{tab === "prehled" ? <OverviewView /> : <SettingsView />}</div>
        )}
      </main>

      <nav className="mw-safe-bottom mw-safe-x border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl">
          {NAV.map(({ id, label, icon: Icon }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
                  on ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    on && "bg-secondary",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
