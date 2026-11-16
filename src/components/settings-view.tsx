"use client";

import * as React from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SwitchPill } from "@/components/ui/switch-pill";
import { klient, prihlasenJako } from "@/lib/supabase";
import { obnovSync, odebirej, stavSync, zapomenSync } from "@/lib/sync";
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

/** Supabase: společný projekt s MicroWins a BetterNotes + účet - stejný se přihlašuje PC v `pc/.env`. */
function SyncCard() {
  const [email, setEmail] = React.useState("");
  const [heslo, setHeslo] = React.useState("");
  const [kdo, setKdo] = React.useState<string | null>(null);
  const [zprava, setZprava] = React.useState("");
  const [prace, setPrace] = React.useState(false);
  const stav = React.useSyncExternalStore((fn) => odebirej("stav", fn), stavSync, stavSync);

  React.useEffect(() => {
    void prihlasenJako().then(setKdo);
  }, []);

  const prihlasit = async () => {
    setPrace(true);
    setZprava("");
    const { data, error } = await klient().auth.signInWithPassword({ email: email.trim(), password: heslo });
    setPrace(false);
    if (error) return setZprava(`Přihlášení se nepovedlo: ${error.message}`);
    setHeslo("");
    setKdo(data.user.email ?? email);
    await obnovSync();
    setZprava("Přihlášeno, data se synchronizují.");
  };

  // Registrace přímo z appky. Se zapnutým potvrzováním e-mailu Supabase relaci nevrátí - nejdřív odkaz v e-mailu.
  const registrovat = async () => {
    setPrace(true);
    setZprava("");
    const { data, error } = await klient().auth.signUp({ email: email.trim(), password: heslo });
    setPrace(false);
    if (error) return setZprava(`Účet se nepodařilo vytvořit: ${error.message}`);
    if (!data.session) return setZprava("Účet je vytvořený. Potvrď ho odkazem v e-mailu a pak se tady přihlas.");
    setHeslo("");
    setKdo(data.user?.email ?? email);
    await obnovSync();
    setZprava("Účet vytvořený a přihlášený, data se synchronizují.");
  };

  const odhlasit = async () => {
    await klient().auth.signOut();
    zapomenSync();
    setKdo(null);
    setZprava("Odhlášeno. Data v telefonu zůstala.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Synchronizace s PC</CardTitle>
        <CardDescription>
          Tabulky, kalendář a příkazy přes Supabase. Bez sítě appka funguje dál a změny pošle, až bude připojení.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {kdo ? (
          <>
            <p className="text-sm">
              Přihlášen jako <span className="font-medium">{kdo}</span>
            </p>
            <p className="tabular text-xs text-muted-foreground">
              {stav.chyba
                ? `Synchronizace selhala: ${stav.chyba}`
                : stav.posledni
                  ? `Synchronizováno ${new Date(stav.posledni).toLocaleTimeString("cs-CZ")}`
                  : "Čekám na první synchronizaci…"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11" onClick={() => void obnovSync()}>
                <RefreshCw /> Synchronizovat teď
              </Button>
              <Button variant="ghost" className="h-11" onClick={() => void odhlasit()}>
                Odhlásit
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="E-mail" htmlFor="sb-email">
              <Input id="sb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" className="h-11" />
            </Field>
            <Field label="Heslo" htmlFor="sb-heslo">
              <Input id="sb-heslo" type="password" value={heslo} onChange={(e) => setHeslo(e.target.value)} autoComplete="current-password" className="h-11" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="brand" className="h-11" disabled={prace || !email || !heslo} onClick={() => void prihlasit()}>
                {prace ? "Pracuji…" : "Přihlásit"}
              </Button>
              <Button variant="outline" className="h-11" disabled={prace || !email || heslo.length < 6} onClick={() => void registrovat()}>
                Vytvořit účet
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Účet je společný s MicroWins a BetterNotes. Nový účet: vyplň e-mail a heslo (aspoň 6 znaků) a dej Vytvořit účet.
            </p>
          </>
        )}
        {zprava ? <p className="text-sm">{zprava}</p> : null}
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
        </CardContent>
      </Card>

      <SyncCard />
    </div>
  );
}
