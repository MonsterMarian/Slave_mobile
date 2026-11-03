"use client";

import { AppShell } from "@/components/app-shell";
import { SlaveProvider } from "@/components/providers/slave-provider";

/**
 * Jediná stránka. Záložky jsou stav, ne routy: spojení s PC (WebSocket) žije
 * v provideru a přepnutí záložky ho nesmí přerušit.
 */
export default function HomePage() {
  return (
    <SlaveProvider>
      <AppShell />
    </SlaveProvider>
  );
}
