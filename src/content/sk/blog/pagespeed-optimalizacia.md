---
title: 'PageSpeed optimalizácia a limity GitHub Pages'
description: 'Lighthouse ukázal Performance 87 na mobile. Self-hosting fontov, WCAG kontrast, trailing slash — a prečo GitHub Pages cache hlavičky bránia dosiahnuť 100. Building in public, štvrtý diel.'
pubDate: 2026-03-08T10:00:00
tags: ['astro', 'performance', 'building-in-public']
draft: true
---

Web má SEO na 100, Best Practices na 100 — ale Performance 87 a Accessibility 94. Lighthouse jasne ukázal, čo treba opraviť.

## Východiskový stav

Po spustení [PageSpeed Insights](https://pagespeed.web.dev/) na `rebjak.com/en` som dostal:

| Metrika | Skóre |
|---------|-------|
| Performance | 87 |
| Accessibility | 94 |
| Best Practices | 100 |
| SEO | 100 |

Štyri hlavné problémy:

1. **Render-blocking Google Fonts** — ušetriteľných ~2000 ms
2. **Nedostatočný farebný kontrast** — WCAG AA zlyhanie
3. **Trailing slash redirect** — `/en` → `/en/` stojí ~925 ms
4. **Externé font requesty** — DNS + TLS handshake na každý návštev

## 1. Render-blocking fonty

### Problém

Klasický `<link rel="stylesheet">` na Google Fonts blokuje renderovanie celej stránky, kým sa font CSS nestiahne. Na pomalšom pripojení to znamená bielu obrazovku na 1-2 sekundy navyše.

### Riešenie

Prvý krok — nahradil som render-blocking link za non-blocking `preload` + `onload` swap pattern:

```html
<!-- Pred: render-blocking -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter..." />

<!-- Po: non-blocking -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="preload"
  as="style"
  href="https://fonts.googleapis.com/css2?family=Inter..."
  onload="this.onload=null;this.rel='stylesheet'"
/>
<noscript>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter..." />
</noscript>
```

Ako to funguje:

- `preload` stiahne CSS na pozadí bez blokovania renderu
- `onload` po stiahnutí prepne `rel` na `stylesheet` a aplikuje fonty
- `this.onload=null` zabráni opakovanému volaniu
- `<noscript>` fallback pre prípad, keď je JavaScript vypnutý

<div class="callout note">

**preconnect** otvára TCP + TLS spojenie na font server ešte pred tým, ako prehliadač vie, že bude potrebovať fonty. Ušetrí to ~100-200 ms pri prvom requeste.

</div>

Toto vyriešilo render-blocking problém, ale fonty sa stále sťahovali z externých serverov. K tomu sa vrátim v bode 4.

## 2. Farebný kontrast (WCAG)

### Problém

Lighthouse označil viacero textových elementov, kde farba textu nemala dostatočný kontrast voči pozadiu. WCAG AA vyžaduje minimálne **4.5:1** pre normálny text a **3:1** pre veľký text.

Prvá iterácia opravila najhoršie prípady, ale Lighthouse CLI test odhalil, že `zinc-500` (`#71717a`) na tmavom pozadí stále nedosahuje 4.5:1. Rovnako `zinc-400` (`#a1a1aa`) na bielom pozadí má len 2.56:1.

### Kontrastné pomery Tailwind zinc škály

| Farba | Hex | vs biela | vs tmavé bg (~#0f1319) |
|-------|-----|----------|------------------------|
| zinc-300 | `#d4d4d8` | 1.48:1 | — |
| zinc-400 | `#a1a1aa` | 2.56:1 | 5.63:1 |
| zinc-500 | `#71717a` | 4.83:1 | 3.97:1 |
| zinc-600 | `#52525b` | 7.73:1 | — |

### Riešenie

Správny vzorec pre sekundárny text: **`text-zinc-500 dark:text-zinc-400`** — obe hodnoty spĺňajú 4.5:1 vo svojom režime.

| Element | Pred | Po |
|---------|------|-----|
| Stats labels | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-400` |
| Nav card labels | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-400` |
| "open →" text | `text-zinc-300 dark:text-zinc-700` | `text-zinc-500 dark:text-zinc-400` |
| Footer text + linky | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-400` |
| Terminal title bar | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-400` |
| CV section headers | `text-zinc-400 dark:text-zinc-500` | `text-zinc-500 dark:text-zinc-400` |
| Blog tag counts | `text-zinc-400 dark:text-zinc-500` | `text-zinc-500 dark:text-zinc-400` |

Pre terminálový výstup na homepage som nahradil inline `color:#64748b` (slate-500, kontrast 3.91:1 na tmavom) za CSS class s dark/light prepínaním:

```css
/* dark mode default */
.term-out { color: #94a3b8; }  /* slate-400 — 7.26:1 na tmavom */

/* light mode override */
:root:not(.dark) .term-out { color: #475569; }  /* slate-600 — 7.58:1 na bielom */
```

Celkovo opravených **12 súborov** — obidve homepage, Header, Footer, oba CV, blog listing SK/EN, blog tags SK/EN.

## 3. Trailing slash redirect

### Problém

GitHub Pages defaultne redirectuje `/en` na `/en/` cez 301 redirect. PageSpeed to zaznamenal ako ~925 ms zbytočnej latencie — prehliadač musí urobiť extra round-trip na server.

### Riešenie

Nastavil som `trailingSlash: 'always'` v Astro konfigurácii:

```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://rebjak.com',
  trailingSlash: 'always',
  // ...
});
```

A aktualizoval som všetky interné linky v projekte, aby mali trailing slash:

```html
<!-- Pred -->
<a href="/en/blog">Blog</a>
<a href="/cv">CV</a>

<!-- Po -->
<a href="/en/blog/">Blog</a>
<a href="/cv/">CV</a>
```

To isté pre dynamické linky:

```astro
<!-- Pred -->
<a href={`/blog/tag/${tag}`}>#{tag}</a>

<!-- Po -->
<a href={`/blog/tag/${tag}/`}>#{tag}</a>
```

Celkovo som opravil linky v 12 súboroch — homepage, blog listy, tag stránky, slug stránky a navigáciu v Header komponente.

## 4. Self-hosting fontov

### Problém

Aj po preload optimalizácii sa fonty sťahovali z `fonts.googleapis.com` a `fonts.gstatic.com`. Každý externý request znamená:

- **DNS lookup** — prehliadač musí preložiť doménu na IP adresu
- **TCP + TLS handshake** — nové spojenie pre každý server
- **Žiadna kontrola nad cachingom** — Google nastavuje vlastné cache hlavičky

Na mobile (simulované pomalé 4G s 150 ms RTT) to pridáva stovky milisekúnd navyše pri každom prvom načítaní.

Google Fonts servuje Inter ako variable font s veľkosťou **230 KB** a JetBrains Mono **56 KB** — spolu **286 KB** cez externé servery.

### Riešenie

Stiahol som fonty a subsettoval ich pomocou `pyftsubset` (z knižnice `fonttools`) na Latin + Latin Extended-A (U+0000-017F) — pokrýva angličtinu aj slovenčinu (č, š, ž, ľ, ď, ť, ň a ďalšie).

```bash
pyftsubset inter-latin.woff2 \
  --output-file=inter-latin.woff2 \
  --flavor=woff2 \
  --layout-features='kern,liga,clig,calt' \
  --unicodes="U+0000-017F,U+2000-206F,U+20AC"
```

Výsledné veľkosti:

| Font | Pred (Google) | Po (subset) | Úspora |
|------|--------------|-------------|--------|
| Inter | 230 KB | 45 KB | –80% |
| JetBrains Mono | 56 KB | 32 KB | –43% |
| **Spolu** | **286 KB** | **77 KB** | **–73%** |

V `global.css` som pridal `@font-face` deklarácie:

```css
@font-face {
    font-family: 'Inter';
    font-style: normal;
    font-weight: 400 700;
    font-display: swap;
    src: url('/fonts/inter-latin.woff2') format('woff2');
    unicode-range: U+0000-017F, U+2000-206F, U+20AC;
}
```

A v `BaseLayout.astro` nahradil všetky Google Fonts linky jednoduchou `preload` deklaráciou:

```html
<!-- Pred: 4 linky na externé servery -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?..." onload="..." />
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?..." /></noscript>

<!-- Po: 2 preload linky na vlastný server -->
<link rel="preload" as="font" type="font/woff2" href="/fonts/inter-latin.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2" href="/fonts/jetbrains-mono-latin.woff2" crossorigin />
```

<div class="callout tip">

**font-display: swap** zobrazí text okamžite s fallback fontom (system-ui) a prepne na Inter/JetBrains Mono po načítaní. Používateľ vidí obsah hneď — font sa vymení bez viditeľného bliknutia.

</div>

## Výsledok

<details>
<summary>Ako otestovať lokálne</summary>

```bash
# build + serve
npx astro build && npx serve dist -l 4444

# v druhom termináli
npx lighthouse http://localhost:4444/en/ \
  --chrome-flags="--headless=new" \
  --output=html \
  --output-path=./lighthouse-report.html
```

</details>

### Lokálne (localhost)

| Stránka | Performance | Accessibility | Best Practices | SEO |
|---------|-------------|---------------|----------------|-----|
| `/` (SK) | 100 | 100 | 100 | 100 |
| `/en/` (EN) | 100 | 100 | 100 | 100 |
| `/blog/` | 100 | 100 | 100 | 100 |
| `/en/blog/` | 100 | 100 | 100 | 100 |

### Produkcia (GitHub Pages)

Lokálne 100 nie je celý príbeh. Lighthouse na produkčnom serveri testuje s reálnou sieťovou latenciou — a mobile preset simuluje **pomalé 4G** (1.6 Mbps, 150 ms RTT).

Pred self-hostingom fontov vyzerala produkcia takto:

| Preset | Performance | Accessibility | Best Practices | SEO |
|--------|-------------|---------------|----------------|-----|
| Desktop | 97 | 100 | 100 | 100 |
| Mobile | 87 | 100 | 100 | 100 |

Po self-hostingu a subsettingu:

| Preset | Performance | Accessibility | Best Practices | SEO |
|--------|-------------|---------------|----------------|-----|
| Desktop | **100** | 100 | 100 | 100 |
| Mobile | **94–95** | 100 | 100 | 100 |

Desktop je na **100**. Mobile skočil z 87 na **94–95** — FCP klesol z 3.0 s na 1.0 s. To je obrovský rozdiel, ale stále nie 100. Prečo?

## Prečo mobile nie je 100 na produkcii

Lighthouse mobile preset nie je len test — simuluje reálne podmienky, s akými sa stretávajú ľudia na pomalšom mobilnom internete. A nie je ich málo: podľa Google [Think with Google](https://www.thinkwithgoogle.com/marketing-strategies/app-and-mobile/mobile-page-speed-new-industry-benchmarks/) **53% mobilných návštevníkov opustí stránku, ak sa načítava viac ako 3 sekundy**.

### Čo sa podarilo optimalizovať

| Metrika | Pred | Po | Zmena |
|---------|------|-----|-------|
| First Contentful Paint | 3.0 s | **1.0 s** | –67% |
| Largest Contentful Paint | 3.0 s | **2.7 s** | –10% |
| Speed Index | 4.4 s | **3.7 s** | –16% |
| Total Blocking Time | 0 ms | 0 ms | — |
| Cumulative Layout Shift | 0 | 0 | — |

FCP klesol na tretinu — to priamo znamená, že používateľ vidí obsah takmer okamžite. TBT 0 a CLS 0 znamenajú, že po načítaní je stránka okamžite funkčná a nič neskáče.

### Čo stále brzdí: limity GitHub Pages

GitHub Pages má tvrdé limity, ktoré nedokážete obísť:

**Cache hlavičky** — GitHub Pages nastavuje `Cache-Control: max-age=600` (10 minút) pre **všetky** statické assety. Aj pre súbory s hash v názve (napr. `_page_.DYzwY8gP.css`), ktoré by ideálne mali `max-age=31536000` (1 rok) s `immutable` flagom. Na toto nemáte vplyv — GitHub Pages nepodporuje vlastné cache hlavičky.

**Žiadne edge caching** — obsah sa servuje z jedného regiónu. CDN ako Cloudflare alebo Vercel majú edge nodes po celom svete a servujú z najbližšieho servera.

**Žiadna kompresia kontrola** — nemôžete nastaviť Brotli kompresiu namiesto gzip, ani optimalizovať response hlavičky.

Toto sú faktory, ktoré stoja zvyšných 5–6 bodov. Na localhost (bez latencie) je všetko 100/100 — produkčná penalizácia je čisto sieťová.

### Prehľad optimalizácií

| Optimalizácia | Dopad | Stav |
|---------------|-------|------|
| Self-hosting fontov | Eliminuje 3 externé requesty | Hotové |
| Font subsetting | –73% veľkosť fontov (286 → 77 KB) | Hotové |
| Trailing slash fix | Eliminuje 301 redirect (~925 ms) | Hotové |
| Non-blocking font loading | Eliminuje render-blocking CSS | Hotové |
| WCAG kontrast (dark + light) | 100% Accessibility | Hotové |
| CDN (Cloudflare/Vercel) | Edge caching, dlhší cache, Brotli | Zvážiť |
| Inline critical CSS | Eliminuje render-blocking Astro CSS | Zvážiť |

<div class="callout note">

Pre statický web na GitHub Pages je **Performance 94–95 na mobile** veľmi dobrý výsledok. Stránka sa na simulovanom pomalom 4G načíta za ~1 sekundu do prvého vykreslenia a za ~2.7 s kompletne. Žiadny JavaScript neblokuje interakciu, žiadny layout shift.

Posledných 5–6 bodov k 100 by priniesol CDN s edge cachingom a dlhšími cache hlavičkami — to je však rozhodnutie o infraštruktúre, nie o kóde.

</div>

## Čo ďalej?

- Breadcrumb schema pre blog posty
- Blog post series schema (isPartOf)
- Lazy loading pre obrázky pod foldom
