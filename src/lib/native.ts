/**
 * Most do nativní vrstvy.
 *
 * Appka běží ve dvou prostředích: v prohlížeči při vývoji a jako Android appka
 * přes Capacitor. Všechno tady je proto podmíněné - v prohlížeči se nic
 * nestane a nic nespadne.
 *
 * Pluginy se importují staticky. Dynamický `await import()` si tahá samostatný
 * JS kus a když ho místní server Capacitoru nenajde, vrátí index.html - skript
 * se "načte", ale je to HTML, kus se nezaregistruje a promise se nikdy
 * nevyřeší. Volání pak visí bez jediné stopy.
 */
import { App } from "@capacitor/app";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNative(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

/** Krátké cvaknutí při stisku mikrofonu nebo Ano / Ne - na mobilu, jinak nic. */
export async function tapFeedback(): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // zařízení bez vibrace - není co řešit
  }
}

/** Stavová lišta v barvě appky, ikony podle světlosti tématu. */
export async function syncStatusBar(dark: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: dark ? "#09090B" : "#FDFDFD" });
  } catch {
    // starší Android bez podpory barvy lišty
  }
}

export async function hideSplash(): Promise<void> {
  if (!isNative()) return;
  try {
    await SplashScreen.hide();
  } catch {
    // splash se skryje sám podle launchShowDuration
  }
}

/**
 * Uloží soubor tam, kde ho uživatel najde: v telefonu do Dokumenty/S_ave
 * (soubor se otevře ze Správce souborů nebo v Excelu), v prohlížeči jako stažení.
 * Vrátí, kam soubor šel (pro hlášku). Chyba (plné úložiště, zakázaný přístup) se vyhodí.
 */
export async function ulozSoubor(nazev: string, data: Uint8Array, typ: string): Promise<string> {
  if (isNative()) {
    let bin = "";
    for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
    await Filesystem.writeFile({ path: `S_ave/${nazev}`, data: btoa(bin), directory: Directory.Documents, recursive: true });
    return `Dokumenty/S_ave/${nazev}`;
  }
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: typ }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nazev });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `Stažené soubory/${nazev}`;
}

/**
 * Otevřený dialog (Radix) zavře jako Escape - hardwarové Zpět má nejdřív
 * zavřít dialog, ne odejít z obrazovky pod ním. Vrátí, jestli nějaký byl.
 */
export function zavriDialog(): boolean {
  if (typeof document === "undefined") return false;
  const dialog = document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
  if (!dialog) return false;
  // Radix poslouchá Escape na dokumentu - událost musí vyjít z prvku uvnitř dialogu
  dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  return true;
}

/**
 * Hardwarové tlačítko Zpět. Uvnitř appky jde o krok zpět,
 * na hlavní obrazovce appku ukončí - tak se chová každá Android appka.
 */
export async function registerBackButton(onBack: () => boolean): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const handle = await App.addListener("backButton", () => {
      const handled = onBack();
      if (!handled) void App.exitApp();
    });
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}
