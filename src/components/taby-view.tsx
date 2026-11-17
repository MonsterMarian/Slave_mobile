"use client";

import * as React from "react";
import { ExternalLink, Monitor, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { klient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Tab {
  titulek: string;
  url: string;
  aktivni: boolean;
}

/**
 * Taby z Kiwi: rozšíření S/_ave Taby (Slave/desktop-agent/kiwi-taby) je posílá do `records`
 * (kind slave_taby). Odsud jde tab otevřít v telefonu nebo poslat na PC jako příkaz pro Slave.
 */
export function TabyView({ doNastaveni }: { doNastaveni: () => void }) {
  const [taby, setTaby] = React.useState<Tab[]>([]);
  const [kdy, setKdy] = React.useState("");
  const [chyba, setChyba] = React.useState("");
  const [pripojeno, setPripojeno] = React.useState<boolean | null>(null);
  const [poslano, setPoslano] = React.useState<string | null>(null);

  const nacti = React.useCallback(async () => {
    const sb = klient();
    const prihlasen = !!sb && !!(await sb.auth.getSession()).data.session;
    setPripojeno(prihlasen);
    if (!sb || !prihlasen) return;
    const { data, error } = await sb.from("records").select("data").eq("kind", "slave_taby").not("data", "is", null);
    if (error) return setChyba(error.message);
    setChyba("");
    const nej = (data as { data: { taby: Tab[]; kdy: string } }[])
      .map((r) => r.data)
      .sort((a, b) => b.kdy.localeCompare(a.kdy))[0];
    setTaby(nej?.taby ?? []);
    setKdy(nej?.kdy ?? "");
  }, []);

  React.useEffect(() => {
    void nacti();
    const znovu = () => document.visibilityState === "visible" && void nacti();
    document.addEventListener("visibilitychange", znovu);
    return () => document.removeEventListener("visibilitychange", znovu);
  }, [nacti]);

  // klic = url tabu, nebo "vse"; potvrzení na tlačítku zmizí po 3 s
  const prikaz = async (text: string, klic: string) => {
    const sb = klient();
    if (!sb) return;
    const { error } = await sb.from("prikazy").insert({ text });
    if (error) return setChyba(`Neodesláno: ${error.message}`);
    setPoslano(klic);
    setTimeout(() => setPoslano((u) => (u === klic ? null : u)), 3000);
  };
  const naPc = (t: Tab) => prikaz(`Otevři na PC tuhle stránku: ${t.url}`, t.url);

  if (pripojeno === false) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">Taby jdou přes Supabase. Nejdřív se přihlas v Nastavení.</p>
        <Button variant="brand" className="h-11" onClick={doNastaveni}>
          Otevřít Nastavení
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-lg font-semibold tracking-tight">Taby z Kiwi</h1>
        <Button variant="ghost" className="size-11" aria-label="Načíst znovu" onClick={() => void nacti()}>
          <RefreshCw className="size-5" />
        </Button>
      </div>
      {kdy ? <p className="tabular text-xs text-muted-foreground">Odesláno z Kiwi {new Date(kdy).toLocaleString("cs-CZ")}</p> : null}
      <Button variant="brand" className="h-11 self-start" onClick={() => void prikaz("Otevři mi na PC taby z telefonu.", "vse")}>
        <Monitor /> {poslano === "vse" ? "Posláno na PC" : "Otevřít vše na PC"}
      </Button>
      {chyba ? <p className="text-sm text-destructive">{chyba}</p> : null}
      {pripojeno && !taby.length && !chyba ? (
        <p className="text-sm text-muted-foreground">Zatím nic. V Kiwi musí být rozšíření S/_ave Taby přihlášené stejným účtem.</p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {taby.map((t) => (
          <li key={t.url} className={cn("flex items-center gap-2 rounded-xl border bg-card p-3", t.aktivni && "border-brand")}>
            <a href={t.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.titulek || t.url}</p>
              <p className="truncate text-xs text-muted-foreground">{t.url}</p>
            </a>
            <a href={t.url} target="_blank" rel="noreferrer" aria-label="Otevřít v telefonu" className="flex size-11 items-center justify-center text-muted-foreground">
              <ExternalLink className="size-5" />
            </a>
            <Button
              variant="ghost"
              className={cn("size-11", poslano === t.url && "text-brand")}
              aria-label={poslano === t.url ? "Posláno na PC" : "Otevřít na PC"}
              onClick={() => void naPc(t)}
            >
              <Monitor className="size-5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
