"use client";

import * as React from "react";
import { ArrowLeft, Check, Pencil, Plus, Sheet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NazevDialog, PotvrzeniDialog } from "@/components/ui/dialog";
import { MAX_RADKU, mrizka, nactiTabulky, nastavBunku, novaTabulka, novyList, rozmer, ulozTabulky, type Tabulka } from "@/lib/tabulky";
import { Chyba, formatuj, nazevSloupce, spocitej } from "@/lib/vzorce";
import { cn } from "@/lib/utils";

// shortcut: tvrdé zabití procesu (force-stop, pád) do 400 ms po posledním znaku ho ztratí; běžné zavření
// a přepnutí appky ukládá hned (visibilitychange). Ukládat bez zpoždění, kdyby to vadilo.
const ULOZIT_PO_MS = 400;

/**
 * Tabulky drží stav i ukládání: seznam a editor jsou jen pohledy.
 * Ukládá se s krátkým zpožděním po změně a hned, když appka jde na pozadí
 * (zavření, přepnutí appky) - nic napsaného se neztratí.
 */
function useTabulky() {
  const [tabulky, setTabulky] = React.useState<Tabulka[]>([]);
  const [nacteno, setNacteno] = React.useState(false);
  const [chyba, setChyba] = React.useState(false);
  const posledni = React.useRef<Tabulka[] | null>(null);

  React.useEffect(() => {
    setTabulky(nactiTabulky());
    setNacteno(true);
  }, []);

  const ulozHned = React.useCallback(() => {
    if (posledni.current) setChyba(!ulozTabulky(posledni.current));
    posledni.current = null;
  }, []);

  React.useEffect(() => {
    if (!nacteno) return;
    posledni.current = tabulky;
    const t = setTimeout(ulozHned, ULOZIT_PO_MS);
    return () => clearTimeout(t);
  }, [tabulky, nacteno, ulozHned]);

  React.useEffect(() => {
    const naPozadi = () => document.visibilityState === "hidden" && ulozHned();
    document.addEventListener("visibilitychange", naPozadi);
    window.addEventListener("pagehide", ulozHned);
    return () => {
      document.removeEventListener("visibilitychange", naPozadi);
      window.removeEventListener("pagehide", ulozHned);
      ulozHned(); // odchod ze záložky
    };
  }, [ulozHned]);

  const zmen = (id: string, fn: (t: Tabulka) => Tabulka) =>
    setTabulky((all) => all.map((t) => (t.id === id ? { ...fn(t), upraveno: Date.now() } : t)));

  return { tabulky, setTabulky, zmen, chyba };
}

function Editor({
  tabulka,
  zmen,
  onZpet,
}: {
  tabulka: Tabulka;
  zmen: (fn: (t: Tabulka) => Tabulka) => void;
  onZpet: () => void;
}) {
  const [listId, setListId] = React.useState(tabulka.listy[0].id);
  const list = tabulka.listy.find((l) => l.id === listId) ?? tabulka.listy[0];
  const [sel, setSel] = React.useState<[number, number]>([0, 0]);
  const raw = list.bunky[`${sel[0]},${sel[1]}`] ?? "";
  const [prejmenovat, setPrejmenovat] = React.useState(false);
  const pole = React.useRef<HTMLInputElement>(null);
  const mrizkaRef = React.useRef<HTMLDivElement>(null);

  // Vybraná buňka (i po Enteru pod okraj) musí být vidět; scroll-margin ji drží mimo sticky záhlaví.
  React.useEffect(() => {
    mrizkaRef.current?.querySelector("[data-vybrana]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel, list.id]);

  const { radky, sloupce } = rozmer(list);
  const hodnoty = React.useMemo(() => spocitej(mrizka(list)), [list]);

  // Každé písmeno jde rovnou do dat (a za chvíli do úložiště) - rozepsaná buňka se při zavření appky neztratí.
  const napsat = (hodnota: string) => {
    const [r, c] = sel;
    zmen((t) => ({ ...t, listy: t.listy.map((l) => (l.id === list.id ? nastavBunku(l, r, c, hodnota) : l)) }));
  };
  const dolu = () => setSel(([r, c]) => [Math.min(r + 1, MAX_RADKU - 1), c]);

  const vyber = (r: number, c: number) => {
    if (r === sel[0] && c === sel[1]) return pole.current?.focus();
    setSel([r, c]);
  };

  const pridatList = () => {
    const l = novyList(`List${tabulka.listy.length + 1}`);
    zmen((t) => ({ ...t, listy: [...t.listy, l] }));
    setListId(l.id);
    setSel([0, 0]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-2 pt-2">
        <Button variant="ghost" className="size-11" aria-label="Zpět na seznam" onClick={onZpet}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{tabulka.nazev}</h1>
      </div>

      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="tabular w-12 shrink-0 rounded-md bg-secondary py-2.5 text-center font-mono text-sm">
          {nazevSloupce(sel[1])}
          {sel[0] + 1}
        </span>
        <input
          ref={pole}
          value={raw}
          onChange={(e) => napsat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              dolu();
            }
          }}
          enterKeyHint="next"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Obsah buňky"
          placeholder="Text, číslo nebo =vzorec"
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          variant="brand"
          className="size-11"
          aria-label="Potvrdit"
          onPointerDown={(e) => e.preventDefault() /* pole nesmí ztratit fokus, klávesnice zůstane */}
          onClick={dolu}
        >
          <Check className="size-5" />
        </Button>
      </div>

      {/* shortcut: vykresluje se celá mřížka (až 1000 × 100), ne jen viditelná část - virtualizovat, až to bude na telefonu pomalé. */}
      <div ref={mrizkaRef} className="min-h-0 flex-1 overflow-auto overscroll-none">
        <table className="tabular border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-8 w-10 min-w-10 border-b border-r bg-muted" />
              {Array.from({ length: sloupce }, (_, c) => (
                <th
                  key={c}
                  className={cn(
                    "sticky top-0 z-10 h-8 min-w-21 border-b border-r bg-muted text-xs font-medium text-muted-foreground",
                    c === sel[1] && "bg-brand-muted text-brand-muted-foreground",
                  )}
                >
                  {nazevSloupce(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: radky }, (_, r) => (
              <tr key={r}>
                <th
                  className={cn(
                    "sticky left-0 z-10 h-11 w-10 min-w-10 border-b border-r bg-muted text-xs font-medium text-muted-foreground",
                    r === sel[0] && "bg-brand-muted text-brand-muted-foreground",
                  )}
                >
                  {r + 1}
                </th>
                {Array.from({ length: sloupce }, (_, c) => {
                  const v = hodnoty[r]?.[c];
                  const on = r === sel[0] && c === sel[1];
                  return (
                    <td
                      key={c}
                      onClick={() => vyber(r, c)}
                      data-vybrana={on || undefined}
                      className={cn(
                        "h-11 max-w-21 min-w-21 scroll-mt-8 scroll-ml-10 truncate border-b border-r px-1.5",
                        typeof v === "number" && "text-right",
                        v instanceof Chyba && "text-destructive",
                        on && "outline-2 -outline-offset-2 outline-brand",
                      )}
                    >
                      {v === undefined ? "" : formatuj(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-t px-2 py-1.5">
        {tabulka.listy.map((l) => (
          <Button
            key={l.id}
            variant={l.id === list.id ? "secondary" : "ghost"}
            className="h-11 shrink-0"
            onClick={() => {
              if (l.id === list.id) return setPrejmenovat(true);
              setListId(l.id);
              setSel([0, 0]);
            }}
          >
            {l.nazev}
            {l.id === list.id ? <Pencil className="text-muted-foreground" /> : null}
          </Button>
        ))}
        <Button variant="ghost" className="size-11 shrink-0" aria-label="Přidat list" onClick={pridatList}>
          <Plus className="size-5" />
        </Button>
      </div>

      <NazevDialog
        otevreno={prejmenovat}
        onZavrit={() => setPrejmenovat(false)}
        titulek="Přejmenovat list"
        vychozi={list.nazev}
        onUlozit={(nazev) => zmen((t) => ({ ...t, listy: t.listy.map((l) => (l.id === list.id ? { ...l, nazev } : l)) }))}
      />
    </div>
  );
}

export function TabulkyView({ otevrena, setOtevrena }: { otevrena: string | null; setOtevrena: (id: string | null) => void }) {
  const { tabulky, setTabulky, zmen, chyba } = useTabulky();
  const [nova, setNova] = React.useState(false);
  const [prejmenovat, setPrejmenovat] = React.useState<Tabulka | null>(null);
  const [smazat, setSmazat] = React.useState<Tabulka | null>(null);

  const tab = tabulky.find((t) => t.id === otevrena);
  const varovani = chyba ? (
    <p className="px-4 py-1 text-sm text-destructive">Nepodařilo se uložit - úložiště telefonu je plné nebo zakázané.</p>
  ) : null;

  if (tab) {
    return (
      <>
        {varovani}
        <Editor key={tab.id} tabulka={tab} zmen={(fn) => zmen(tab.id, fn)} onZpet={() => setOtevrena(null)} />
      </>
    );
  }

  const serazene = [...tabulky].sort((a, b) => b.upraveno - a.upraveno);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <h1 className="flex-1 text-lg font-semibold tracking-tight">Tabulky</h1>
          <Button variant="brand" className="h-11" onClick={() => setNova(true)}>
            <Plus /> Nová
          </Button>
        </div>
        {varovani}
        {serazene.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Zatím žádná tabulka.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {serazene.map((t) => (
              <li key={t.id} className="flex items-center gap-1 rounded-xl border bg-card pr-1">
                <button type="button" onClick={() => setOtevrena(t.id)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 text-left">
                  <Sheet className="size-5 shrink-0 text-brand" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{t.nazev}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.listy.length} {t.listy.length === 1 ? "list" : t.listy.length < 5 ? "listy" : "listů"}
                    </span>
                  </span>
                </button>
                <Button variant="ghost" className="size-11" aria-label={`Přejmenovat ${t.nazev}`} onClick={() => setPrejmenovat(t)}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" className="size-11 text-destructive" aria-label={`Smazat ${t.nazev}`} onClick={() => setSmazat(t)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NazevDialog
        otevreno={nova}
        onZavrit={() => setNova(false)}
        titulek="Nová tabulka"
        vychozi={`Tabulka ${tabulky.length + 1}`}
        onUlozit={(nazev) => {
          const t = novaTabulka(nazev);
          setTabulky((all) => [...all, t]);
          setOtevrena(t.id);
        }}
      />
      <NazevDialog
        otevreno={prejmenovat !== null}
        onZavrit={() => setPrejmenovat(null)}
        titulek="Přejmenovat tabulku"
        vychozi={prejmenovat?.nazev ?? ""}
        onUlozit={(nazev) => prejmenovat && zmen(prejmenovat.id, (t) => ({ ...t, nazev }))}
      />
      <PotvrzeniDialog
        otevreno={smazat !== null}
        onZavrit={() => setSmazat(null)}
        titulek="Smazat tabulku?"
        text={smazat ? `„${smazat.nazev}“ se smaže i se všemi listy. Nejde to vrátit.` : undefined}
        onPotvrdit={() => smazat && setTabulky((all) => all.filter((t) => t.id !== smazat.id))}
      />
    </div>
  );
}
