# Barvy S/_ave

Akcent je jediný: **S/_ave modrá**. Má variantu pro tmavý a světlý režim spočítanou na kontrast WCAG AA
(≥ 4,5:1 pro text i pro popisek na tlačítku). Logo appky (oko) je ve stejné modré.

## Proč modrá jako výchozí
- **Značka:** web slashunderscore je monochromní (#121212, #0E0E0E) s modrými akcenty #38BDF8 a #2563EB — S/_ave
  je produkt té firmy, takže sdílí její akcent.
- **Logo:** původně teplé oko (zlatá #F8C868 → oranžová #F89848 → korálová #E86838) je od 2026-11-03
  přebarvené do stejné modré, appka i ikona tak mají jednu barvu.
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

| režim | akcent | kontrast na pozadí | text na tlačítku |
|---|---|---|---|
| tmavý (`#09090B`, karta `#18181B`) | `#38BDF8` | 9,3:1 (karta 8,3:1) | `#09090B` (9,3:1) |
| světlý (`#FDFDFD` / bílá) | `#0369A1` | 5,9:1 | `#FFFFFF` (5,9:1) |

`accent-soft` (`--brand-muted`, pozadí vybraného dne, buňky a aktivní záložky) je akcent namíchaný na 15 %
do pozadí - neprůhledně, aby přes sticky záhlaví tabulky neprosvítal obsah. Chyby a mazání (`--destructive`)
zůstávají červené.

Hodnoty jsou v `src/app/globals.css` (`--brand`, `--brand-foreground`) a kvůli testu v `src/lib/barvy.ts`;
`src/lib/barvy.test.ts` hlídá, že sedí s CSS a mají kontrast ≥ 4,5:1 na pozadí, kartě i pro text na tlačítku.

## Vyřazené volby
Uživatel 2026-11-03 nejdřív dostal výběr ze sedmi barev a pak ho zrušil - zůstala jen S/_ave modrá.
Vyřazené: oranžová z loga (`#F89848` / `#C2410C`), Facebook modrá (`#4B9BFF` / `#0866FF`), OnlyFans azurová
(`#00AFF0` / `#0077A8`), indigo (`#8C95FF` / `#4F46E5`), Excel zelená (`#33C481` / `#107C41`) a fialová
z Material 3 (`#D0BCFF` / `#6750A4`) - všechny ve tvaru tmavý / světlý, s kontrastem ≥ 4,5:1. Kód výběru
je v gitu (commit c4af6d6), kdyby se vracel.
