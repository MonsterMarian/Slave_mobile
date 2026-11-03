/**
 * Značka loga z obrázku s tmavým pozadím (např. vygenerovaného Gemini).
 *
 * Spuštění: npm run logo:source [-- vstup.jpg]   (výchozí assets/logo_source.jpg)
 * Výstup:   assets/logo_mark.png - průhledné pozadí, čtverec kolem značky.
 * Pak:      npm run android:assets  (ikony, splash, logo v hlavičce)
 *
 * Pozadí zdroje není jednolité (vinětace ~rgb(7,0,0) až ~rgb(40,30,26)), takže
 * nejde položit na #09090B - byl by vidět čtverec. Alfa se proto bere z jasu
 * (nejsilnější kanál): pod PRAH_POZADI průhledné, nad PRAH_PLNE plné, mezi tím
 * plynulý přechod, ať záře kolem čar nevypadá useknutě. Barva poloprůhledných
 * pixelů se „odmíchá" z černé (barva / alfa), takže na tmavém podkladu vypadá
 * značka jako v originále.
 */
import sharp from "sharp";

const VSTUP = process.argv[2] ?? "assets/logo_source.jpg";
const VYSTUP = "assets/logo_mark.png";
const PRAH_POZADI = 32;
const PRAH_PLNE = 150;
/** okraj kolem značky v podílu strany čtverce */
const OKRAJ = 0.02;

const { data, info } = await sharp(VSTUP).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const out = Buffer.alloc(W * H * 4);
let [x0, y0, x1, y1] = [W, H, -1, -1];

for (let i = 0; i < W * H; i++) {
  const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const t = Math.min(1, Math.max(0, (Math.max(r, g, b) - PRAH_POZADI) / (PRAH_PLNE - PRAH_POZADI)));
  const a = t * t * (3 - 2 * t); // smoothstep
  out[i * 4] = a > 0 ? Math.min(255, r / Math.max(a, 1e-3)) : 0;
  out[i * 4 + 1] = a > 0 ? Math.min(255, g / Math.max(a, 1e-3)) : 0;
  out[i * 4 + 2] = a > 0 ? Math.min(255, b / Math.max(a, 1e-3)) : 0;
  out[i * 4 + 3] = Math.round(a * 255);
  if (a > 0.04) {
    const [x, y] = [i % W, Math.floor(i / W)];
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
}
if (x1 < 0) throw new Error(`V ${VSTUP} není nic světlejšího než pozadí.`);

// Čtverec kolem značky se středem ve středu jejího obdélníku; co přeteče za obrázek, je průhledné.
const strana = Math.ceil(Math.max(x1 - x0, y1 - y0) * (1 + 2 * OKRAJ));
const left = Math.round((x0 + x1 - strana) / 2);
const top = Math.round((y0 + y1 - strana) / 2);
const pruhledna = { r: 0, g: 0, b: 0, alpha: 0 };

await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .extend({
    top: Math.max(0, -top),
    left: Math.max(0, -left),
    bottom: Math.max(0, top + strana - H),
    right: Math.max(0, left + strana - W),
    background: pruhledna,
  })
  .extract({ left: Math.max(0, left), top: Math.max(0, top), width: strana, height: strana })
  .png()
  .toFile(VYSTUP);

console.log(`${VSTUP} → ${VYSTUP} (${strana} × ${strana}, značka ${x0},${y0}–${x1},${y1})`);
