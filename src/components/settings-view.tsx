"use client";

import * as React from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
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
import { klient, nactiPripojeni, prihlasenJako, ulozPripojeni } from "@/lib/supabase";
import { obnovSync, odebirej, stavSync, zapomenSync } from "@/lib/sync";
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

/** Supabase: projekt (výchozí z buildu) + účet - stejný se přihlašuje PC v `pc/.env`. */
function SyncCard() {
  const [url, setUrl] = React.useState("");
  const [klic, setKlic] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [heslo, setHeslo] = React.useState("");
  const [kdo, setKdo] = React.useState<string | null>(null);
  const [zprava, setZprava] = React.useState("");
  const [prace, setPrace] = React.useState(false);
  const stav = React.useSyncExternalStore((fn) => odebirej("stav", fn), stavSync, stavSync);

  React.useEffect(() => {
    const p = nactiPripojeni();
    setUrl(p.url);
    setKlic(p.klic);
    void prihlasenJako().then(setKdo);
  }, []);

  const prihlasit = async () => {
    setPrace(true);
    setZprava("");
    ulozPripojeni({ url, klic });
    const sb = klient();
    if (!sb) {
      setPrace(false);
      return setZprava("Adresa musí začínat https:// a klíč nesmí chybět.");
    }
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: heslo });
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
    ulozPripojeni({ url, klic });
    const sb = klient();
    if (!sb) {
      setPrace(false);
      return setZprava("Adresa musí začínat https:// a klíč nesmí chybět.");
    }
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password: heslo });
    setPrace(false);
    if (error) return setZprava(`Účet se nepodařilo vytvořit: ${error.message}`);
    if (!data.session) return setZprava("Účet je vytvořený. Potvrď ho odkazem v e-mailu a pak se tady přihlas.");
    setHeslo("");
    setKdo(data.user?.email ?? email);
    await obnovSync();
    setZprava("Účet vytvořený a přihlášený, data se synchronizují.");
  };

  const odhlasit = async () => {
    await klient()?.auth.signOut();
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
            <p className="text-xs text-muted-foreground">Nový účet: vyplň e-mail a heslo (aspoň 6 znaků) a dej Vytvořit účet.</p>
            <details className="text-xs">
              <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground">
                Projekt {url ? url.replace(/^https:\/\//, "") : "(nevyplněný)"}
              </summary>
              <div className="flex flex-col gap-3">
                <Field label="Adresa projektu" htmlFor="sb-url">
                  <Input id="sb-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" spellCheck={false} className="h-11 font-mono text-xs" />
                </Field>
                <Field label="Publishable klíč" htmlFor="sb-klic">
                  <Input id="sb-klic" value={klic} onChange={(e) => setKlic(e.target.value)} placeholder="sb_publishable_…" autoComplete="off" spellCheck={false} className="h-11 font-mono text-xs" />
                </Field>
              </div>
            </details>
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

      <UpdateCard />
    </div>
  );
}
