"use client";
// shortcut: spojení s PC je v UI vypnuté (2026-11-03) — vrátit, až uživatel řekne

import * as React from "react";
import { Bell, CalendarDays, Cpu, HardDrive, ListChecks, MemoryStick, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSlave } from "@/components/providers/slave-provider";
import { fetchDashboard, fetchKalendar, SlaveError } from "@/lib/api";
import { formatHodina, nazevDne, poDnech } from "@/lib/kalendar";
import { OFFLINE_HINT, STAV_POPISEK, type Dashboard, type Kalendar, type Uloha } from "@/lib/protocol";
import { isConfigured } from "@/lib/settings";
import { cn, relativeTime } from "@/lib/utils";

const POLL_MS = 5000;
// shortcut: kalendář jen po minutě (mění se zřídka, 5 s by zbytečně zatěžovalo PC), ručně kdykoliv; zkrátit, kdyby chyběly čerstvé události.
const KALENDAR_MS = 60_000;

function useVisible(): boolean {
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function StavBadge({ stav }: { stav: Uloha["stav"] }) {
  return (
    <Badge
      variant={stav === "ceka" ? "solid" : stav === "bezi" || stav === "obnoveno" ? "brand" : "outline"}
      className={cn(stav === "chyba" && "border-destructive/50 text-destructive")}
    >
      {STAV_POPISEK[stav] ?? stav}
    </Badge>
  );
}

function Meter({ icon: Icon, label, value, unit, pct }: { icon: typeof Cpu; label: string; value: string; unit: string; pct?: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="tabular text-lg font-semibold">
        {value}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </div>
      {pct !== undefined ? (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function OverviewView() {
  const { settings, hydrated } = useSlave();
  const visible = useVisible();
  const [dash, setDash] = React.useState<Dashboard | null>(null);
  const [kal, setKal] = React.useState<Kalendar | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const lastKal = React.useRef(0);
  const configured = isConfigured(settings);

  const refresh = React.useCallback(
    async (force = false) => {
      if (!configured) return;
      setLoading(true);
      try {
        setDash(await fetchDashboard(settings));
        setError(null);
        if (force || Date.now() - lastKal.current > KALENDAR_MS) {
          lastKal.current = Date.now();
          // Rozbitý kalendář nemá schovat sezení, chyba se ukáže jen u něj.
          setKal(
            await fetchKalendar(settings, 7).catch((e: unknown) => ({
              nastaveno: true,
              udalosti: [],
              chyby: [e instanceof SlaveError ? e.message : OFFLINE_HINT],
            })),
          );
        }
      } catch (e) {
        setError(e instanceof SlaveError ? e.message : OFFLINE_HINT);
      } finally {
        setLoading(false);
      }
    },
    [configured, settings],
  );

  // Poll jen v popředí: na pozadí by budil telefon i PC zbytečně.
  React.useEffect(() => {
    if (!hydrated || !visible || !configured) return;
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [hydrated, visible, configured, refresh]);

  if (hydrated && !configured) {
    return <p className="px-4 py-16 text-center text-sm text-muted-foreground">Nejdřív spáruj telefon s PC v Nastavení.</p>;
  }

  const now = new Date();
  const ulohy = [...(dash?.ulohy ?? [])].sort((a, b) => b.start - a.start);
  const pripominky = [...(dash?.pripominky ?? [])].sort((a, b) => a.kdy - b.kdy);
  const dny = kal ? poDnech(kal.udalosti, now) : [];

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Přehled</h1>
        <Button variant="ghost" size="icon" aria-label="Obnovit" onClick={() => void refresh(true)} disabled={loading}>
          <RefreshCw className={cn(loading && "animate-spin")} />
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}

      {dash ? (
        <div className="grid grid-cols-3 gap-2">
          <Meter icon={Cpu} label="CPU" value={String(Math.round(dash.system.cpu))} unit="%" pct={dash.system.cpu} />
          <Meter icon={MemoryStick} label="RAM" value={String(Math.round(dash.system.ram))} unit="%" pct={dash.system.ram} />
          <Meter icon={HardDrive} label="Volno" value={String(Math.round(dash.system.disk_free_gb))} unit="GB" />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4" /> Sezení
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {ulohy.length === 0 ? <p className="text-sm text-muted-foreground">{dash ? "Žádné úlohy." : "Načítám…"}</p> : null}
          {ulohy.map((u) => (
            <div key={u.id} className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">{u.nazev || u.ukol}</p>
                <StavBadge stav={u.stav} />
              </div>
              <p className="text-xs text-muted-foreground">
                {u.projekt}
                {u.nastroj ? ` · ${u.nastroj}` : ""} · {relativeTime(u.start)}
              </p>
              {u.chyba ? <p className="line-clamp-3 text-xs text-destructive">{u.chyba}</p> : null}
              {!u.chyba && u.vysledek ? <p className="line-clamp-3 text-xs text-muted-foreground">{u.vysledek}</p> : null}
              {u.odlozeno ? <p className="text-xs text-muted-foreground">Odloženo: {u.odlozeno}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" /> Připomínky
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pripominky.length === 0 ? <p className="text-sm text-muted-foreground">{dash ? "Žádné připomínky." : "Načítám…"}</p> : null}
          {pripominky.map((p, i) => {
            const kdy = new Date(p.kdy * 1000);
            return (
              <div key={`${p.kdy}-${i}`} className="flex items-baseline gap-3 text-sm">
                <span className="tabular w-28 shrink-0 text-xs text-muted-foreground">
                  {nazevDne(kdy, now)} {formatHodina(kdy)}
                </span>
                <span>{p.text}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4" /> Kalendář na 7 dní
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!kal ? <p className="text-sm text-muted-foreground">Načítám…</p> : null}
          {kal && !kal.nastaveno ? <p className="text-sm text-muted-foreground">Na PC není nastavený žádný kalendář.</p> : null}
          {kal?.chyby.map((c) => (
            <p key={c} className="text-xs text-destructive">
              {c}
            </p>
          ))}
          {kal?.nastaveno && dny.length === 0 ? <p className="text-sm text-muted-foreground">Týden je volný.</p> : null}
          {dny.map((den) => (
            <div key={den.key} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{den.nazev}</p>
              {den.udalosti.map((u) => (
                <div key={`${u.uid}-${u.zacatek}`} className="flex items-baseline gap-3 text-sm">
                  <span className="tabular w-16 shrink-0 text-xs text-muted-foreground">
                    {u.celodenni ? "celý den" : formatHodina(u.od)}
                  </span>
                  <span className="min-w-0">
                    {u.nazev}
                    {u.misto ? <span className="text-muted-foreground"> · {u.misto}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
