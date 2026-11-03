import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Nativní obal appky. `webDir` je statický export z `next build`.
 * Appka běží ze souborů v telefonu; jediný server, se kterým mluví, je
 * sidecar Slave na PC (LAN / Tailscale).
 */
const config: CapacitorConfig = {
  appId: "cz.slave.mobil",
  appName: "Slave",
  webDir: "out",
  server: {
    /*
     * WebView servíruje appku z `http://localhost` místo výchozího
     * `https://localhost`. Dva důvody:
     *  - sidecar na PC je na čistém http:// a ws://; stránka z https by na něj
     *    nesměla (mixed content) a WebSocket by se ani nepokusil spojit
     *  - sidecar pouští jen Origin `http://localhost` - přesně ten tím vznikne
     *    (hostname zůstává výchozí `localhost`)
     * Pozor: localStorage patří k originu, takže po změně schématu by appka
     * uložené spárování neviděla (jiný origin = jiné úložiště).
     */
    androidScheme: "http",
    cleartext: true,
  },
  android: {
    // Vlastní pozadí, ať mezi splash screenem a appkou neprobleskne bílá.
    backgroundColor: "#09090B",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#09090B",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090B",
    },
    // Android 15+ kreslí edge-to-edge. Capacitor pak vstřikuje
    // --safe-area-inset-*, na které sahá globals.css.
    SystemBars: {
      insetsHandling: "css",
    },
  },
};

export default config;
