"use client";

import * as React from "react";
import { ArrowLeft, Check, Download, Pencil, Plus, Sheet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NazevDialog, PotvrzeniDialog } from "@/components/ui/dialog";
import { ulozSoubor } from "@/lib/native";
import { naplanuj, odebirej } from "@/lib/sync";
import {
  MAX_RADKU,
  mrizka,
  nactiTabulky,
  nastavBunku,
  nastavSirku,
  novaTabulka,
  novyList,
  rozmer,
  SIRKA_MAX,
  SIRKA_MIN,
  sirkaPodleTextu,
  ulozTabulky,
  type Tabulka,
} from "@/lib/tabulky";
import { Chyba, formatuj, nazevSloupce, spocitej } from "@/lib/vzorce";
import { nazevSouboru, xlsx } from "@/lib/xlsx";
import { cn } from "@/lib/utils";

const XLSX_TYP = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
    // Synchronizace změnila data v telefonu (třeba z PC): rozepsané neuložené už je v nich sloučené.
    return odebirej("tabulky", () => {
      posledni.current = null;
      setTabulky(nactiTabulky());
    });
  }, []);

  const ulozHned = React.useCallback(() => {
    if (posledni.current) {
      setChyba(!ulozTabulky(posledni.current));
      naplanuj("tabulky");
    }
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

const SIRKA_ZAHLAVI_RADKU = 40;

/** Šířka textu v px stejným písmem, jakým se kreslí buňky (text-sm, písmo z body). */
function useMeritko(): (t: string) => number {
  return React.useMemo(() => {
    let ctx: CanvasRenderingContext2D | null | undefined;
    return (t: string) => {
      if (ctx === undefined) {
        ctx = document.createElement("canvas").getContext("2d");
        if (ctx) ctx.font = `14px ${getComputedStyle(document.body).fontFamily}`;
      }
      return ctx ? ctx.measureText(t).width : t.length * 8;
    };
  }, []);
}

/**
 * Úchyt na pravém okraji záhlaví sloupce: tažením se sloupec roztáhne / zúží (uloží se při puštění),
 * dvojím ťuknutím se vrátí na šířku podle textu.
 */
function Uchyt({ sirka, onTah, onKonec, onAuto }: { sirka: number; onTah: (px: number) => void; onKonec: (px: number) => void; onAuto: () => void }) {
  const tah = React.useRef<{ x: number; od: number; px: number; posun: boolean } | null>(null);
  const posledniTuk = React.useRef(0);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Roztáhnout sloupec (dvojí ťuknutí = podle textu)"
      className="absolute right-0 top-0 flex h-full w-6 cursor-col-resize touch-none items-center justify-end pr-0.5"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        tah.current = { x: e.clientX, od: sirka, px: sirka, posun: false };
      }}
      onPointerMove={(e) => {
        const t = tah.current;
        if (!t) return;
        const dx = e.clientX - t.x;
        if (Math.abs(dx) > 3) t.posun = true;
        if (!t.posun) return;
        t.px = Math.min(SIRKA_MAX, Math.max(SIRKA_MIN, t.od + dx));
        onTah(t.px);
      }}
      onPointerUp={() => {
        const t = tah.current;
        tah.current = null;
        if (!t) return;
        if (t.posun) return onKonec(t.px);
        const ted = Date.now();
        if (ted - posledniTuk.current < 350) {
          posledniTuk.current = 0;
          onAuto();
        } else posledniTuk.current = ted;
      }}
      onPointerCancel={() => (tah.current = null)}
    >
      <span className="h-4 w-0.5 rounded-full bg-muted-foreground/40" />
    </div>
  );
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
  const [smazatList, setSmazatList] = React.useState(false);
  const [hlaska, setHlaska] = React.useState("");
  const pole = React.useRef<HTMLInputElement>(null);
  const mrizkaRef = React.useRef<HTMLDivElement>(null);

  // Vybraná buňka (i po Enteru pod okraj) musí být vidět; scroll-margin ji drží mimo sticky záhlaví.
  React.useEffect(() => {
    mrizkaRef.current?.querySelector("[data-vybrana]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sel, list.id]);

  const { radky, sloupce } = rozmer(list);
  const hodnoty = React.useMemo(() => spocitej(mrizka(list)), [list]);

  // Šířky: ručně roztažené ze `sirky`, ostatní podle nejdelšího zobrazeného textu ve sloupci.
  const mer = useMeritko();
  const podleTextu = React.useMemo(
    () => Array.from({ length: sloupce }, (_, c) => sirkaPodleTextu(hodnoty.map((r) => (r[c] === undefined ? "" : formatuj(r[c]))), mer)),
    [hodnoty, sloupce, mer],
  );
  const [tazeny, setTazeny] = React.useState<{ c: number; px: number } | null>(null);
  const sirka = (c: number) => (tazeny?.c === c ? tazeny.px : (list.sirky?.[c] ?? podleTextu[c]));
  const sirkaTabulky = SIRKA_ZAHLAVI_RADKU + Array.from({ length: sloupce }, (_, c) => sirka(c)).reduce((s, x) => s + x, 0);
  const zmenSirku = (c: number, px: number | null) => {
    setTazeny(null);
    zmen((t) => ({ ...t, listy: t.listy.map((l) => (l.id === list.id ? nastavSirku(l, c, px) : l)) }));
  };

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

  const odebratList = () => {
    const i = tabulka.listy.findIndex((l) => l.id === list.id);
    const zbyle = tabulka.listy.filter((l) => l.id !== list.id);
    if (zbyle.length === 0) return; // poslední list se nemaže (tlačítko se ani neukáže)
    zmen((t) => ({ ...t, listy: t.listy.filter((l) => l.id !== list.id) }));
    setListId(zbyle[Math.max(0, i - 1)].id);
    setSel([0, 0]);
  };

  React.useEffect(() => {
    if (!hlaska) return;
    const t = setTimeout(() => setHlaska(""), 6000);
    return () => clearTimeout(t);
  }, [hlaska]);

  const exportovat = async () => {
    try {
      const kam = await ulozSoubor(nazevSouboru(tabulka.nazev), xlsx(tabulka), XLSX_TYP);
      setHlaska(`Uloženo: ${kam}`);
    } catch (e) {
      setHlaska(`Export se nepovedl: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-2 pt-2">
        <Button variant="ghost" className="size-11" aria-label="Zpět na seznam" onClick={onZpet}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{tabulka.nazev}</h1>
        <Button variant="ghost" className="size-11" aria-label="Exportovat do .xlsx" title="Exportovat do .xlsx" onClick={() => void exportovat()}>
          <Download className="size-5" />
        </Button>
      </div>
      {hlaska ? (
        <p role="status" className={cn("px-4 pb-1 text-sm", hlaska.startsWith("Export se") ? "text-destructive" : "text-muted-foreground")}>
          {hlaska}
        </p>
      ) : null}

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
        <table className="tabular table-fixed border-separate border-spacing-0 text-sm" style={{ width: sirkaTabulky }}>
          <colgroup>
            <col style={{ width: SIRKA_ZAHLAVI_RADKU }} />
            {Array.from({ length: sloupce }, (_, c) => (
              <col key={c} style={{ width: sirka(c) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-8 border-b border-r bg-muted" />
              {Array.from({ length: sloupce }, (_, c) => (
                <th
                  key={c}
                  className={cn(
                    "sticky top-0 z-10 h-8 border-b border-r bg-muted text-xs font-medium text-muted-foreground",
                    c === sel[1] && "bg-brand-muted text-brand-muted-foreground",
                    list.sirky?.[c] !== undefined && "underline decoration-dotted underline-offset-2",
                  )}
                >
                  {nazevSloupce(c)}
                  <Uchyt
                    sirka={sirka(c)}
                    onTah={(px) => setTazeny({ c, px })}
                    onKonec={(px) => zmenSirku(c, px)}
                    onAuto={() => zmenSirku(c, null)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: radky }, (_, r) => (
              <tr key={r}>
                <th
                  className={cn(
                    "sticky left-0 z-10 h-11 border-b border-r bg-muted text-xs font-medium text-muted-foreground",
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
                        "h-11 scroll-mt-8 scroll-ml-10 truncate border-b border-r px-1.5",
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
        {tabulka.listy.length > 1 ? (
          <Button
            variant="ghost"
            className="ml-auto size-11 shrink-0 text-destructive"
            aria-label={`Smazat list ${list.nazev}`}
            onClick={() => setSmazatList(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <PotvrzeniDialog
        otevreno={smazatList}
        onZavrit={() => setSmazatList(false)}
        titulek="Smazat list?"
        text={`„${list.nazev}“ se smaže i s obsahem. Nejde to vrátit.`}
        onPotvrdit={odebratList}
      />
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
