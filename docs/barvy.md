# Barvy S/_ave

Výchozí akcent je **S/_ave modrá (sky)**, oranžová z loga je volba. Každá barva má variantu pro tmavý
a světlý režim spočítanou na kontrast WCAG AA (≥ 4,5:1 pro text i pro popisek na tlačítku).

## Proč modrá jako výchozí
- **Značka:** web slashunderscore je monochromní (#121212, #0E0E0E) s modrými akcenty #38BDF8 a #2563EB — S/_ave
  je produkt té firmy, takže sdílí její akcent.
- **Komplementární k logu:** logo je teplé (zlatá #F8C868 → oranžová #F89848 → korálová #E86838). Modrá leží na
  barevném kole naproti, logo na splashi a ikoně proto vynikne, místo aby splývalo s UI.
- **Chyby musí být vidět:** v tabulkách se chyby (#DĚLENÍ/0!) a mazání značí červeně (odstín 0°). Oranžová má
  odstín 27°, jantar z mpL 37° — pro lidi s protanopií/deuteranopií jsou téměř stejné jako červená. Modrá (198°)
  je od červené co nejdál.
- **Kategorie appky:** kalendáře a tabulky na Androidu jsou typicky modré nebo zelené (Google Kalendář, Outlook,
  Samsung Kalendář modré; Excel zelený) — modrá čte jako klid a soustředění, oranžová jako upozornění.

## Proč dvě varianty každé barvy
Brandové modré jsou stavěné na bílé pozadí. Facebook #1877F2 má na tmavém pozadí appky jen 4,7:1 a na kartě
#18181B 4,2:1 (pod AA), bílý text na něm 4,2:1. Proto má tmavý režim světlejší tón stejného odstínu (#4B9BFF,
7,0:1) s tmavým textem na tlačítku — stejný princip jako tóny 80/40 v Material 3. Ve světlém režimu se použije
nová modrá Facebooku #0866FF (bílý text 4,8:1). Obdobně slashunderscore #2563EB má na tmavém jen 3,9:1 — v tmavém
režimu ho zastupuje #38BDF8 / #6B9BFF.

## Proč ne
- **Červená:** koliduje s chybami a mazáním.
- **Jantar z mpL #F5A524:** vlastní barva jiné appky, odstínem blízko oranžové z loga — nahrazen oranžovou z loga.
- **Zlatá z loga #F8C868:** ve světlém režimu potřebuje tak tmavý tón (#A16207), že vypadá hnědě.
- **Material You (barvy z tapety):** v čistém WebView nejsou dostupné, chtělo by nativní plugin — možné později.

## Paleta

Kontrast tmavé varianty proti pozadí `#09090B` (a kartě `#18181B`), světlé proti bílé; text na tlačítku proti
akcentu. Hodnoty jsou v `src/lib/barvy.ts` (jediný zdroj - CSS se z nich generuje), `src/lib/barvy.test.ts`
hlídá, že každá barva má obě varianty a kontrast ≥ 4,5:1 na pozadí i kartě i pro text na akcentu.

| id | název v UI | tmavý režim | text na tlačítku | světlý režim | text na tlačítku |
|---|---|---|---|---|---|
| `sky` (výchozí) | S/_ave modrá | `#38BDF8` (9,3:1, karta 8,3:1) | `#09090B` (9,3:1) | `#0369A1` (5,9:1) | `#FFFFFF` (5,9:1) |
| `orange` | Oranžová z loga | `#F89848` (9,1:1, karta 8,1:1) | `#09090B` (9,1:1) | `#C2410C` (5,2:1) | `#FFFFFF` (5,2:1) |
| `fb` | Facebook modrá | `#4B9BFF` (7,0:1, karta 6,3:1) | `#09090B` (7,0:1) | `#0866FF` (4,8:1) | `#FFFFFF` (4,8:1) |
| `of` | OnlyFans azurová | `#00AFF0` (7,9:1, karta 7,1:1) | `#09090B` (7,9:1) | `#0077A8` (5,0:1) | `#FFFFFF` (5,0:1) |
| `indigo` | Indigo | `#8C95FF` (7,4:1, karta 6,6:1) | `#09090B` (7,4:1) | `#4F46E5` (6,3:1) | `#FFFFFF` (6,3:1) |
| `excel` | Excel zelená | `#33C481` (8,9:1, karta 7,9:1) | `#09090B` (8,9:1) | `#107C41` (5,3:1) | `#FFFFFF` (5,3:1) |
| `violet` | Fialová (Material 3) | `#D0BCFF` (11,7:1, karta 10,4:1) | `#09090B` (11,7:1) | `#6750A4` (6,4:1) | `#FFFFFF` (6,4:1) |

`accent-soft` (`--brand-muted`, pozadí vybraného dne, buňky a aktivní záložky) je akcent namíchaný na 15 %
do pozadí - neprůhledně, aby přes sticky záhlaví tabulky neprosvítal obsah. Chyby a mazání (`--destructive`)
jsou na akcentu nezávislé. Splash a ikona appky se s akcentem nemění (jsou z loga).

## Jak to funguje
- `<html data-accent="sky">` - skript v `<head>` (`layout.tsx`) ho nastaví z `localStorage["slave:accent"]`
  dřív, než se cokoli vykreslí, takže jiná barva neprobliká.
- `layout.tsx` vloží `<style>` z `akcentCss()`: `html[data-accent=…]` (světlý) a `html.dark[data-accent=…]`
  (tmavý) přepíšou `--brand` a `--brand-foreground`. Tailwind tokeny (`bg-brand`, `text-brand`, …) zůstávají.
- Nová barva = řádek v `PALETY`; test ji nepustí, když nemá kontrast.
