"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle, PotvrzeniDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SwitchPill } from "@/components/ui/switch-pill";
import {
  DNY_ZKR,
  klicDne,
  MESICE,
  mrizkaMesice,
  nactiUdalosti,
  popisCasu,
  popisDne,
  posunMesic,
  udalostiDne,
  ulozUdalosti,
  zkontroluj,
  type Udalost,
} from "@/lib/udalosti";
import { noveId } from "@/lib/uloziste";
import { cn } from "@/lib/utils";

const prazdna = (den: string): Udalost => ({
  id: "",
  nazev: "",
  od: den,
  do: den,
  celyDen: false,
  casOd: "09:00",
  casDo: "10:00",
  misto: "",
  poznamka: "",
});

function UdalostDialog({
  udalost,
  onZavrit,
  onUlozit,
  onSmazat,
}: {
  udalost: Udalost | null;
  onZavrit: () => void;
  onUlozit: (u: Udalost) => void;
  onSmazat: (u: Udalost) => void;
}) {
  const [u, setU] = React.useState<Udalost | null>(udalost);
  const [chyba, setChyba] = React.useState<string | null>(null);
  const [mazat, setMazat] = React.useState(false);
  React.useEffect(() => {
    setU(udalost);
    setChyba(null);
  }, [udalost]);
  if (!u) return null;
  const zmen = (p: Partial<Udalost>) => setU({ ...u, ...p });
  const ulozit = () => {
    const c = zkontroluj(u);
    if (c) return setChyba(c);
    onUlozit({ ...u, nazev: u.nazev.trim(), casOd: u.celyDen ? "" : u.casOd, casDo: u.celyDen ? "" : u.casDo });
  };

  return (
    <Dialog open={udalost !== null} onOpenChange={(o) => !o && onZavrit()}>
      <DialogContent>
        <DialogTitle>{u.id ? "Upravit událost" : "Nová událost"}</DialogTitle>
        <Field label="Název" htmlFor="u-nazev">
          <Input id="u-nazev" value={u.nazev} onChange={(e) => zmen({ nazev: e.target.value })} className="h-11 text-base" />
        </Field>
        <button
          type="button"
          aria-pressed={u.celyDen}
          onClick={() => zmen({ celyDen: !u.celyDen, casOd: u.casOd || "09:00" })}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-sm font-medium">Celý den</span>
          <SwitchPill on={u.celyDen} />
        </button>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Od" htmlFor="u-od">
            <Input
              id="u-od"
              type="date"
              value={u.od}
              onChange={(e) => zmen({ od: e.target.value, do: e.target.value > u.do ? e.target.value : u.do })}
              className="h-11 text-base"
            />
          </Field>
          <Field label="Do" htmlFor="u-do">
            <Input id="u-do" type="date" value={u.do} onChange={(e) => zmen({ do: e.target.value })} className="h-11 text-base" />
          </Field>
          {u.celyDen ? null : (
            <>
              <Field label="Čas od" htmlFor="u-cod">
                <Input id="u-cod" type="time" value={u.casOd} onChange={(e) => zmen({ casOd: e.target.value })} className="h-11 text-base" />
              </Field>
              <Field label="Čas do" htmlFor="u-cdo">
                <Input id="u-cdo" type="time" value={u.casDo} onChange={(e) => zmen({ casDo: e.target.value })} className="h-11 text-base" />
              </Field>
            </>
          )}
        </div>
        <Field label="Místo" htmlFor="u-misto">
          <Input id="u-misto" value={u.misto} onChange={(e) => zmen({ misto: e.target.value })} className="h-11 text-base" />
        </Field>
        <Field label="Poznámka" htmlFor="u-pozn">
          <Textarea id="u-pozn" value={u.poznamka} onChange={(e) => zmen({ poznamka: e.target.value })} className="text-base" />
        </Field>
        {chyba ? <p className="text-sm text-destructive">{chyba}</p> : null}
        <DialogFooter>
          {u.id ? (
            <Button variant="outline" className="mr-auto h-11 text-destructive" onClick={() => setMazat(true)}>
              Smazat
            </Button>
          ) : null}
          <Button variant="outline" className="h-11" onClick={onZavrit}>
            Zrušit
          </Button>
          <Button variant="brand" className="h-11" onClick={ulozit}>
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
      <PotvrzeniDialog
        otevreno={mazat}
        onZavrit={() => setMazat(false)}
        titulek="Smazat událost?"
        text={`„${u.nazev}“ se smaže z kalendáře.`}
        onPotvrdit={() => onSmazat(u)}
      />
    </Dialog>
  );
}

export function KalendarView() {
  const dnes = klicDne(new Date());
  const [udalosti, setUdalosti] = React.useState<Udalost[]>([]);
  const [vybrany, setVybrany] = React.useState(dnes);
  const [mesic, setMesic] = React.useState(() => ({ rok: new Date().getFullYear(), mesic: new Date().getMonth() }));
  const [upravit, setUpravit] = React.useState<Udalost | null>(null);
  const [chybaUlozeni, setChybaUlozeni] = React.useState(false);

  React.useEffect(() => setUdalosti(nactiUdalosti()), []);

  const zmenit = (dalsi: Udalost[]) => {
    setUdalosti(dalsi);
    setChybaUlozeni(!ulozUdalosti(dalsi));
  };

  const dny = mrizkaMesice(mesic.rok, mesic.mesic);
  const dneska = udalostiDne(udalosti, vybrany);

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <div className="flex items-center gap-1">
        <h1 className="flex-1 pl-1 text-lg font-semibold capitalize tracking-tight">
          {MESICE[mesic.mesic]} {mesic.rok}
        </h1>
        <Button
          variant="outline"
          className="h-11 px-3"
          onClick={() => {
            const d = new Date();
            setMesic({ rok: d.getFullYear(), mesic: d.getMonth() });
            setVybrany(dnes);
          }}
        >
          Dnes
        </Button>
        <Button variant="ghost" className="size-11" aria-label="Předchozí měsíc" onClick={() => setMesic(posunMesic(mesic.rok, mesic.mesic, -1))}>
          <ChevronLeft className="size-5" />
        </Button>
        <Button variant="ghost" className="size-11" aria-label="Další měsíc" onClick={() => setMesic(posunMesic(mesic.rok, mesic.mesic, 1))}>
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {DNY_ZKR.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="-mt-2 grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {dny.map((d) => {
          const k = klicDne(d);
          const jeho = udalostiDne(udalosti, k);
          const cizi = d.getMonth() !== mesic.mesic;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setVybrany(k);
                if (cizi) setMesic({ rok: d.getFullYear(), mesic: d.getMonth() });
              }}
              aria-pressed={k === vybrany}
              aria-label={`${popisDne(k)}, událostí ${jeho.length}`}
              className={cn(
                "flex h-14 min-w-0 flex-col items-center gap-1 bg-background pt-1.5",
                cizi && "text-muted-foreground/60",
                k === vybrany && "bg-brand-muted",
              )}
            >
              <span
                className={cn(
                  "tabular flex size-7 items-center justify-center rounded-full text-sm",
                  k === dnes && "bg-brand font-semibold text-brand-foreground",
                )}
              >
                {d.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {jeho.slice(0, 3).map((u) => (
                  <span key={u.id} className={cn("size-1.5 rounded-full", u.celyDen ? "bg-brand" : "bg-foreground/70")} />
                ))}
                {jeho.length > 3 ? <span className="text-[9px] leading-none text-muted-foreground">+</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <h2 className="flex-1 pl-1 text-sm font-semibold first-letter:uppercase">{popisDne(vybrany)}</h2>
        <Button variant="brand" className="h-11" onClick={() => setUpravit(prazdna(vybrany))}>
          <Plus /> Přidat
        </Button>
      </div>
      {chybaUlozeni ? <p className="text-sm text-destructive">Nepodařilo se uložit - úložiště telefonu je plné nebo zakázané.</p> : null}
      {dneska.length === 0 ? (
        <p className="px-1 py-4 text-center text-sm text-muted-foreground">Žádné události.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dneska.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setUpravit(u)}
                className="flex min-h-14 w-full gap-3 rounded-xl border bg-card px-3 py-2.5 text-left"
              >
                <span className={cn("w-1 shrink-0 rounded-full", u.celyDen ? "bg-brand" : "bg-foreground/50")} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{u.nazev}</span>
                  <span className="text-xs text-muted-foreground">{popisCasu(u)}</span>
                  {u.misto ? (
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" /> {u.misto}
                    </span>
                  ) : null}
                  {u.poznamka ? <span className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{u.poznamka}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <UdalostDialog
        udalost={upravit}
        onZavrit={() => setUpravit(null)}
        onUlozit={(u) => {
          zmenit(u.id ? udalosti.map((x) => (x.id === u.id ? u : x)) : [...udalosti, { ...u, id: noveId() }]);
          setUpravit(null);
        }}
        onSmazat={(u) => {
          zmenit(udalosti.filter((x) => x.id !== u.id));
          setUpravit(null);
        }}
      />
    </div>
  );
}
