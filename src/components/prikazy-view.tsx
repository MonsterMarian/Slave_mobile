"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { klient } from "@/lib/supabase";
import { odebirej } from "@/lib/sync";
import { cn } from "@/lib/utils";

interface Prikaz {
  id: string;
  text: string;
  stav: "ceka" | "bezi" | "hotovo" | "chyba";
  vysledek: string;
  vytvoreno: string;
}

const STAV: Record<Prikaz["stav"], string> = { ceka: "Čeká na PC", bezi: "PC pracuje…", hotovo: "Hotovo", chyba: "Chyba" };

/**
 * Příkaz pro PC: text jde do Supabase (`prikazy`), na PC ho vezme `pc/most.mjs` a provede přes Claude Code.
 * Změny tabulek a kalendáře přijdou zpátky synchronizací; tady je vidět stav a odpověď.
 */
export function PrikazyView({ doNastaveni }: { doNastaveni: () => void }) {
  const [text, setText] = React.useState("");
  const [seznam, setSeznam] = React.useState<Prikaz[]>([]);
  const [chyba, setChyba] = React.useState("");
  const [odesilam, setOdesilam] = React.useState(false);
  const [pripojeno, setPripojeno] = React.useState<boolean | null>(null);

  const nacti = React.useCallback(async () => {
    const sb = klient();
    const prihlasen = !!sb && !!(await sb.auth.getSession()).data.session;
    setPripojeno(prihlasen);
    if (!sb || !prihlasen) return;
    const { data, error } = await sb.from("prikazy").select("id,text,stav,vysledek,vytvoreno").order("vytvoreno", { ascending: false }).limit(30);
    if (error) setChyba(error.message);
    else {
      setChyba("");
      setSeznam(data as Prikaz[]);
    }
  }, []);

  React.useEffect(() => {
    void nacti();
    return odebirej("prikazy", () => void nacti());
  }, [nacti]);

  const odeslat = async () => {
    const sb = klient();
    if (!sb || !text.trim()) return;
    setOdesilam(true);
    const { error } = await sb.from("prikazy").insert({ text: text.trim() });
    setOdesilam(false);
    if (error) return setChyba(`Neodesláno: ${error.message}`);
    setText("");
    void nacti();
  };

  if (pripojeno === false) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">Příkazy pro PC jdou přes Supabase. Nejdřív se přihlas v Nastavení.</p>
        <Button variant="brand" className="h-11" onClick={doNastaveni}>
          Otevřít Nastavení
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <h1 className="text-lg font-semibold tracking-tight">Příkaz pro PC</h1>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Např. Přidej do tabulky Kontakty řádek: Jan Novák, 777 123 456, nový, novak.cz"
        aria-label="Příkaz"
        className="min-h-28 text-base"
      />
      <Button variant="brand" className="h-11 self-end" disabled={odesilam || !text.trim()} onClick={() => void odeslat()}>
        <Send /> {odesilam ? "Odesílám…" : "Odeslat"}
      </Button>
      {chyba ? <p className="text-sm text-destructive">{chyba}</p> : null}

      <ul className="flex flex-col gap-2">
        {seznam.map((p) => (
          <li key={p.id} className="flex flex-col gap-1.5 rounded-xl border bg-card p-3">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-medium">{p.text}</p>
              <Badge variant={p.stav === "hotovo" ? "brand" : "outline"} className={cn("shrink-0", p.stav === "chyba" && "text-destructive")}>
                {STAV[p.stav] ?? p.stav}
              </Badge>
            </div>
            {p.vysledek ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.vysledek}</p> : null}
            <p className="tabular text-xs text-muted-foreground">{new Date(p.vytvoreno).toLocaleString("cs-CZ")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
