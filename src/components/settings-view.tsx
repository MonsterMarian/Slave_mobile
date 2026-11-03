"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SwitchPill } from "@/components/ui/switch-pill";
import { useSlave } from "@/components/providers/slave-provider";
import { fetchDashboard, SlaveError } from "@/lib/api";
import { currentBundleVersion } from "@/lib/live-update";
import { OFFLINE_HINT } from "@/lib/protocol";
import { DEFAULT_PORT, formatToken, isConfigured, normalizeToken, parseHost, validPort, type Settings } from "@/lib/settings";
import { getServerTheme, getTheme, setTheme, subscribeTheme } from "@/lib/theme";

type Test = { kind: "idle" } | { kind: "running" } | { kind: "ok"; text: string } | { kind: "fail"; text: string };

function ToggleRow({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 py-2 text-left"
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
  const { settings, setSettings, hydrated } = useSlave();
  const theme = React.useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const [host, setHost] = React.useState("");
  const [port, setPort] = React.useState(String(DEFAULT_PORT));
  const [token, setToken] = React.useState("");
  const [test, setTest] = React.useState<Test>({ kind: "idle" });

  React.useEffect(() => {
    if (!hydrated) return;
    setHost(settings.host);
    setPort(String(settings.port));
    setToken(formatToken(settings.token));
    // Jen po načtení; pak pole patří uživateli.
  }, [hydrated]);

  /** Pole -> uložená podoba, nebo text chyby, když něco chybí či nedává smysl. */
  const parsed = (): Settings | string => {
    const h = parseHost(host);
    const p = h.port ?? Number(port.trim() || DEFAULT_PORT);
    const next = { ...settings, host: h.host, port: p, token: normalizeToken(token) };
    if (!next.host) return "Chybí adresa PC.";
    if (!validPort(p)) return "Port musí být číslo 1–65535.";
    if (!next.token) return "Chybí mobilní token.";
    return next;
  };

  const save = (): Settings | null => {
    const next = parsed();
    if (typeof next === "string") {
      setTest({ kind: "fail", text: next });
      return null;
    }
    setSettings(next);
    setHost(next.host);
    setPort(String(next.port));
    setToken(formatToken(next.token));
    return next;
  };

  const tryConnection = async () => {
    const next = save();
    if (!next) return;
    setTest({ kind: "running" });
    try {
      const d = await fetchDashboard(next);
      setTest({
        kind: "ok",
        text: `Spojeno. PC odpovídá (CPU ${Math.round(d.system.cpu)} %, ${d.ulohy.length} úloh).`,
      });
    } catch (e) {
      setTest({ kind: "fail", text: e instanceof SlaveError ? e.message : OFFLINE_HINT });
    }
  };

  const version = currentBundleVersion();

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="text-lg font-semibold tracking-tight">Nastavení</h1>

      <Card>
        <CardHeader>
          <CardTitle>Spárování s PC</CardTitle>
          <CardDescription>
            Na PC otevři Slave → Nastavení → Telefon, zaškrtni „Povolit přístup z telefonu“, restartuj Slave a opiš
            adresu, port a token. Telefon musí být na stejné Wi-Fi, nebo s PC v Tailscale (adresa 100.x.x.x).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label="Adresa PC" htmlFor="host" hint="IP v síti (192.168.1.20) nebo jméno v Tailscale.">
            <Input
              id="host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.20"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
              className="h-11 text-base"
            />
          </Field>
          <Field label="Port" htmlFor="port">
            <Input
              id="port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
              className="tabular h-11 text-base"
            />
          </Field>
          <Field label="Mobilní token" htmlFor="token" hint="Pomlčky a mezery nevadí, velikost písmen taky ne.">
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onBlur={() => setToken(formatToken(token))}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="h-11 font-mono text-base tracking-wide"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" className="h-11" onClick={() => save() && setTest({ kind: "ok", text: "Uloženo." })}>
              Uložit
            </Button>
            <Button variant="brand" className="h-11" onClick={() => void tryConnection()} disabled={test.kind === "running"}>
              {test.kind === "running" ? <Loader2 className="animate-spin" /> : null}
              Vyzkoušet spojení
            </Button>
          </div>
          {test.kind === "ok" ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /> {test.text}
            </p>
          ) : null}
          {test.kind === "fail" ? (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="mt-0.5 size-4 shrink-0" /> {test.text}
            </p>
          ) : null}
          {hydrated && !isConfigured(settings) ? (
            <p className="text-xs text-muted-foreground">Dokud není adresa i token uložené, appka se k PC nepřipojuje.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hlas a vzhled</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          <ToggleRow
            label="Předčítat odpovědi"
            hint="Slave odpovědi přečte nahlas i v telefonu (česky)."
            on={settings.tts}
            onToggle={() => setSettings({ ...settings, tts: !settings.tts })}
          />
          <ToggleRow
            label="Tmavý režim"
            on={theme === "dark"}
            onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
          />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Slave pro Android{version ? ` · verze ${version}` : " · vývojová verze"}
      </p>
    </div>
  );
}
