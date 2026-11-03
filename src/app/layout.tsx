import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "S/_ave",
  description: "Slave v telefonu: kalendář a tabulky.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFDFD" },
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
  ],
  // Nativní appka: obsah až do rohů, žádné zoomování dvojklikem.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/** Nastaví téma před prvním paintem, aby neproblikl světlý podklad. */
const themeScript = `try{var d=document.documentElement;var t=localStorage.getItem("slave:theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))d.classList.add("dark")}catch(e){}`;

/**
 * Záchranná brzda živých aktualizací (stejná jako v MicroWins a mpL).
 *
 * Běží dřív než kód appky a je schválně mimo něj: rozbitá aktualizace by
 * appku nespustila, takže by se neměl kdo vrátit zpět a telefon by zůstal
 * u bílé obrazovky. Značku `booting` maže appka po naběhnutí; když je po deseti
 * vteřinách pořád tam, nasadí se zpátky verze zabalená v APK.
 */
const rescueScript = `try{
if(localStorage.getItem("slave:ota:booting")){
  setTimeout(function(){
    try{
      if(window.__mwBooted) return;
      var w=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.WebView;
      if(!w) return;
      localStorage.removeItem("slave:ota:booting");
      localStorage.removeItem("slave:ota:current");
      localStorage.removeItem("slave:ota:pending");
      w.setServerBasePath({path:""});
      w.persistServerBasePath();
      setTimeout(function(){ window.location.reload(); }, 400);
    }catch(e){}
  },10000);
}
}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: rescueScript }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
