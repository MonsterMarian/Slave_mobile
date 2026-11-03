"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SwitchPill } from "@/components/ui/switch-pill";
import { currentBundleVersion } from "@/lib/live-update";
import { getServerTheme, getTheme, setTheme, subscribeTheme } from "@/lib/theme";

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

export function SettingsView() {
  const theme = React.useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const version = currentBundleVersion();

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="text-lg font-semibold tracking-tight">Nastavení</h1>

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
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Kalendář a tabulky jsou uložené jen v tomhle telefonu.
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Slave pro Android{version ? ` · verze ${version}` : " · vývojová verze"}
      </p>
    </div>
  );
}
