"use client";

import { AppShell } from "@/components/app-shell";

/**
 * Jediná stránka. Záložky jsou stav, ne routy.
 *
 * shortcut: spojení s PC je v UI vypnuté (2026-11-03) - `SlaveProvider` (WebSocket na PC) se nepouští,
 * vrátit obalení `<SlaveProvider><AppShell /></SlaveProvider>`, až uživatel řekne.
 */
export default function HomePage() {
  return <AppShell />;
}
