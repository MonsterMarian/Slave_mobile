"use client";

import * as React from "react";
import { CalendarDays, Send, Settings, Sheet } from "lucide-react";
import { KalendarView } from "@/components/kalendar-view";
import { PrikazyView } from "@/components/prikazy-view";
import { Button } from "@/components/ui/button";
import { SettingsView } from "@/components/settings-view";
import { TabulkyView } from "@/components/tabulky-view";
import { applyPendingUpdate, checkForUpdate, markBootSucceeded } from "@/lib/live-update";
import { hideSplash, isNative, registerBackButton, syncStatusBar, zavriDialog } from "@/lib/native";
import { spustSync } from "@/lib/sync";
import { cn } from "@/lib/utils";

// shortcut: spojení s PC je v UI vypnuté (2026-11-03) - Rozhovor a Přehled (chat-view, overview-view,
// slave-provider) vrátit do NAV, až uživatel řekne.
type Tab = "kalendar" | "tabulky" | "prikaz" | "nastaveni";

// Nastavení není v liště - otevírá se ozubeným kolem vpravo nahoře.
const NAV: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "kalendar", label: "Kalendář", icon: CalendarDays },
  { id: "tabulky", label: "Tabulky", icon: Sheet },
  { id: "prikaz", label: "Příkaz", icon: Send },
];

/**
 * Nativní chování appky: schování splash screenu po prvním vykreslení,
 * stavová lišta podle tématu, živé aktualizace a hardwarové Zpět
 * (nejdřív zavře otevřený dialog; z Nastavení tam, odkud se přišlo, z otevřené tabulky na seznam, z Tabulek
 * na Kalendář, z Kalendáře ven).
 * V prohlížeči nic.
 */
function useNativeShell(onBack: () => boolean) {
  const current = React.useRef(onBack);
  current.current = onBack;

  React.useEffect(() => {
    void hideSplash();
    void syncStatusBar(document.documentElement.classList.contains("dark"));
    markBootSucceeded();
    const stopSync = spustSync();
    void applyPendingUpdate().then((res) => {
      if (!res.applied) void checkForUpdate();
    });
    return stopSync;
  }, []);

  React.useEffect(() => {
    let cleanup = () => {};
    void registerBackButton(() => current.current()).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup();
  }, []);
}

export function AppShell() {
  const [tab, setTab] = React.useState<Tab>("kalendar");
  const [odkud, setOdkud] = React.useState<Tab>("kalendar");
  const [tabulka, setTabulka] = React.useState<string | null>(null);
  const [native, setNative] = React.useState(false);

  const zNastaveni = () => setTab(odkud);
  const doNastaveni = () => {
    if (tab === "nastaveni") return zNastaveni();
    setOdkud(tab);
    setTab("nastaveni");
  };

  useNativeShell(() => {
    if (zavriDialog()) return true;
    if (tab === "nastaveni") zNastaveni();
    else if (tab === "tabulky" && tabulka) setTabulka(null);
    else if (tab !== "kalendar") setTab("kalendar");
    else return false;
    return true;
  });
  React.useEffect(() => setNative(isNative()), []);

  return (
    // h-dvh: lišty stojí, roluje jen obsah záložky (editor tabulky má vlastní posuv).
    <div className={cn("flex h-dvh flex-col", native && "select-none")}>
      <header className="mw-safe-top mw-safe-x border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
          {/* Wordmark slashunderscore: „/_" v akcentu, logo je jen na ikoně a splashi. */}
          <span className="flex-1 text-lg font-semibold tracking-tight" aria-label="Slave">
            S<span className="text-brand">/_</span>ave
          </span>
          <Button
            variant="ghost"
            className={cn("-mr-2 size-11", tab === "nastaveni" && "bg-brand-muted text-brand")}
            aria-label="Nastavení"
            aria-pressed={tab === "nastaveni"}
            onClick={doNastaveni}
          >
            <Settings className="size-5" />
          </Button>
        </div>
      </header>

      <main className="mw-safe-x mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
        {tab === "tabulky" ? (
          <TabulkyView otevrena={tabulka} setOtevrena={setTabulka} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "kalendar" ? <KalendarView /> : tab === "prikaz" ? <PrikazyView doNastaveni={doNastaveni} /> : <SettingsView onZpet={zNastaveni} />}
          </div>
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
                onClick={() => {
                  if (id === tab && id === "tabulky") setTabulka(null);
                  setTab(id);
                }}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors",
                  on ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    on && "bg-brand-muted text-brand",
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
