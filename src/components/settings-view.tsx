"use client";

import * as React from "react";
import { ArrowLeft, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SwitchPill } from "@/components/ui/switch-pill";
import {
  applyPendingUpdate,
  checkForUpdate,
  currentBundleVersion,
  DEFAULT_UPDATE_URL,
  getUpdateUrl,
  pendingBundleVersion,
  setUpdateUrl,
} from "@/lib/live-update";
import { getAkcent, getServerAkcent, PALETY, setAkcent, subscribeAkcent } from "@/lib/barvy";
import { getServerTheme, getTheme, setTheme, subscribeTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// shortcut: spojení s PC je v UI vypnuté (2026-11-03) - spárování (adresa, port, token, Vyzkoušet spojení)
// a předčítání jsou v gitu v commitu b227d3c, vrátit, až uživatel řekne.

function ToggleRow({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
    >
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <SwitchPill on={on} />
    </button>
  );
}

/** Výběr akcentu: kolečko v barvě pro aktuální režim, pod ním název; náhled hned. */
function BarvaVolba({ dark }: { dark: boolean }) {
  const akcent = React.useSyncExternalStore(subscribeAkcent, getAkcent, getServerAkcent);
  return (
    <div className="flex flex-col gap-2 pt-2">
      <span className="text-sm font-medium">Barva</span>
      <div className="grid grid-cols-4 gap-x-1 gap-y-3">
        {PALETY.map((p) => {
          const v = dark ? p.tmava : p.svetla;
          const on = p.id === akcent;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => setAkcent(p.id)}
              className="flex min-w-0 flex-col items-center gap-1 text-center"
            >
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-full",
                  on && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                )}
                style={{ backgroundColor: v.akcent, color: v.text }}
              >
                {on ? <Check className="size-5" /> : null}
              </span>
              <span className={cn("text-[11px] leading-tight", on ? "text-foreground" : "text-muted-foreground")}>
                {p.nazev}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Živé aktualizace z GitHubu - stejně jako MicroWins a mpL (hláška podle opravy mpL 5d58c02). */
function UpdateCard() {
  const [url, setUrl] = React.useState("");
  const [current, setCurrent] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState("");

  React.useEffect(() => {
    setUrl(getUpdateUrl());
    setCurrent(currentBundleVersion());
    setPending(pendingBundleVersion());
  }, []);

  const onApply = async () => {
    const res = await applyPendingUpdate();
    if (res.error) {
      setStatusMsg("Nasazení selhalo: " + res.error);
      setPending(pendingBundleVersion());
      setCurrent(currentBundleVersion());
    } else if (!res.applied) {
      setStatusMsg("Tahle verze už běží.");
      setPending(null);
    }
  };

  const onCheck = async () => {
    setUpdateUrl(url);
    setChecking(true);
    setStatusMsg("");
    const res = await checkForUpdate();
    setChecking(false);
    const waiting = pendingBundleVersion();
    setPending(waiting);

    if (res.kind === "downloaded") {
      setStatusMsg(`Aktualizace ${res.version} stažená. Nasadí se tlačítkem nebo po zavření a otevření appky.`);
    } else if (res.kind === "up-to-date") {
      // „up-to-date" přijde i ve chvíli, kdy nejnovější verze je stažená a jen čeká na nasazení.
      setStatusMsg(waiting ? "Nejnovější verze je stažená, stačí ji nasadit." : "Máš nejnovější verzi.");
    } else if (res.kind === "disabled") {
      setStatusMsg("Aktualizace jdou jen v appce v telefonu.");
    } else {
      setStatusMsg("Aktualizace se nepovedla: " + res.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktualizace z GitHubu</CardTitle>
        <CardDescription>
          Appka si při startu sama stáhne novou verzi. Nové APK je potřeba jen při zásahu do nativní části (ikona,
          oprávnění, pluginy).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-11" disabled={checking} onClick={() => void onCheck()}>
            <RefreshCw className={cn(checking && "animate-spin")} />
            {checking ? "Hledám…" : "Zkontrolovat teď"}
          </Button>
          {pending ? (
            <Button variant="brand" className="h-11" onClick={() => void onApply()}>
              Nasadit {pending}
            </Button>
          ) : null}
        </div>
        <p className="tabular text-xs text-muted-foreground">
          {pending ? `Běží ${current ?? "verze z APK"}, čeká ${pending}` : current ? `Verze ${current}` : "Vývojová verze"}
        </p>
        {statusMsg ? <p className="text-sm">{statusMsg}</p> : null}
        <details className="text-xs">
          <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground">
            Adresa manifestu {url === DEFAULT_UPDATE_URL ? "(výchozí)" : "(vlastní)"}
          </summary>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setUpdateUrl(url)}
            placeholder={DEFAULT_UPDATE_URL}
            autoComplete="off"
            spellCheck={false}
            className="h-11 font-mono text-xs"
          />
          {url !== DEFAULT_UPDATE_URL ? (
            <button
              type="button"
              onClick={() => {
                setUrl(DEFAULT_UPDATE_URL);
                setUpdateUrl(DEFAULT_UPDATE_URL);
              }}
              className="min-h-11 text-muted-foreground"
            >
              Vrátit výchozí adresu
            </button>
          ) : null}
        </details>
      </CardContent>
    </Card>
  );
}

export function SettingsView({ onZpet }: { onZpet: () => void }) {
  const theme = React.useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="-ml-2 flex items-center gap-1">
        <Button variant="ghost" className="size-11" aria-label="Zpět" onClick={onZpet}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Nastavení</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vzhled</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          <ToggleRow
            label="Tmavý režim"
            on={theme === "dark"}
            onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
          />
          <BarvaVolba dark={theme === "dark"} />
        </CardContent>
      </Card>

      <UpdateCard />

      <p className="text-center text-xs text-muted-foreground">Kalendář a tabulky jsou uložené jen v tomhle telefonu.</p>
    </div>
  );
}
