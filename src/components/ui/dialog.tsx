"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** shadcn/ui Dialog (Radix), upravený na telefon: nahoře, ať ho klávesnice nepřekryje, a roluje sám. */
export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "animate-in-up fixed inset-x-3 top-[calc(var(--mw-safe-top)+12px)] z-50 mx-auto flex max-h-[calc(100dvh-var(--mw-safe-top)-24px)] max-w-lg flex-col gap-4 overflow-y-auto rounded-xl border bg-card p-5 text-card-foreground shadow-lg",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon" className="absolute right-2 top-2 size-11" aria-label="Zavřít">
            <X className="size-5" />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("pr-10 text-base font-semibold tracking-tight", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap justify-end gap-2 pt-1", className)} {...props} />;
}

/** Potvrzení nevratné akce (smazání) - místo `window.confirm`. */
export function PotvrzeniDialog({
  otevreno,
  onZavrit,
  titulek,
  text,
  akce = "Smazat",
  onPotvrdit,
}: {
  otevreno: boolean;
  onZavrit: () => void;
  titulek: string;
  text?: string;
  akce?: string;
  onPotvrdit: () => void;
}) {
  return (
    <Dialog open={otevreno} onOpenChange={(o) => !o && onZavrit()}>
      <DialogContent>
        <DialogTitle>{titulek}</DialogTitle>
        {text ? <p className="text-sm text-muted-foreground">{text}</p> : null}
        <DialogFooter>
          <Button variant="outline" className="h-11 flex-1" onClick={onZavrit}>
            Zrušit
          </Button>
          <Button
            variant="destructive"
            className="h-11 flex-1"
            onClick={() => {
              onPotvrdit();
              onZavrit();
            }}
          >
            {akce}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog s jedním textovým polem (název tabulky, listu). */
export function NazevDialog({
  otevreno,
  onZavrit,
  titulek,
  vychozi,
  onUlozit,
}: {
  otevreno: boolean;
  onZavrit: () => void;
  titulek: string;
  vychozi: string;
  onUlozit: (nazev: string) => void;
}) {
  const [nazev, setNazev] = React.useState(vychozi);
  React.useEffect(() => {
    if (otevreno) setNazev(vychozi);
  }, [otevreno, vychozi]);
  const ulozit = () => {
    if (!nazev.trim()) return;
    onUlozit(nazev.trim());
    onZavrit();
  };
  return (
    <Dialog open={otevreno} onOpenChange={(o) => !o && onZavrit()}>
      <DialogContent>
        <DialogTitle>{titulek}</DialogTitle>
        <input
          autoFocus
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ulozit()}
          enterKeyHint="done"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <DialogFooter>
          <Button variant="outline" className="h-11 flex-1" onClick={onZavrit}>
            Zrušit
          </Button>
          <Button variant="brand" className="h-11 flex-1" onClick={ulozit} disabled={!nazev.trim()}>
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
