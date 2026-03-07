---
title: 'PageSpeed optimalizácia — fonty, kontrast a trailing slash'
description: 'Lighthouse ukázal Performance 87 a Accessibility 94. Opravil som render-blocking fonty, nedostatočný farebný kontrast a zbytočný redirect. Building in public, štvrtý diel.'
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

Tri hlavné problémy:

1. **Render-blocking Google Fonts** — ušetriteľných ~2000 ms
2. **Nedostatočný farebný kontrast** — WCAG AA zlyhanie
3. **Trailing slash redirect** — `/en` → `/en/` stojí ~925 ms

## 1. Render-blocking fonty

### Problém

Klasický `<link rel="stylesheet">` na Google Fonts blokuje renderovanie celej stránky, kým sa font CSS nestiahne. Na pomalšom pripojení to znamená bielu obrazovku na 1-2 sekundy navyše.

### Riešenie

Nahradil som render-blocking link za non-blocking `preload` + `onload` swap pattern:

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

## 2. Farebný kontrast (WCAG)

### Problém

Lighthouse označil viacero textových elementov, kde farba textu nemala dostatočný kontrast voči pozadiu. WCAG AA vyžaduje minimálne 4.5:1 pre normálny text a 3:1 pre veľký text.

Problematické triedy:

- `text-zinc-400` na bielom pozadí — kontrast ~3.3:1 (zlyhanie)
- `text-zinc-300` na bielom pozadí — kontrast ~2.2:1 (zlyhanie)
- `text-zinc-500 dark:text-zinc-500` — v light mode OK, ale na hranici

### Riešenie

Systematicky som prešiel homepage (SK aj EN), footer a navigáciu:

| Element | Pred | Po |
|---------|------|-----|
| Stats labels | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-500` |
| Nav card labels | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-500` |
| Nav card description | `text-zinc-500 dark:text-zinc-500` | `text-zinc-600 dark:text-zinc-400` |
| "open →" text | `text-zinc-300 dark:text-zinc-700` | `text-zinc-400 dark:text-zinc-600` |
| Footer text | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-500` |
| Terminal title bar | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-500` |
| Hero description | `text-zinc-500 dark:text-zinc-500` | `text-zinc-600 dark:text-zinc-400` |

Princíp: v light mode posunúť text k tmavším odtieňom (zinc-500/600), v dark mode k svetlejším (zinc-400/500).

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

## Výsledok

Všetky tri problémy opravené v jednom PR:

- **Fonty**: Stránka sa renderuje okamžite, fonty sa načítajú na pozadí
- **Kontrast**: WCAG AA splnený pre všetky textové elementy
- **Redirect**: Žiadny zbytočný 301, priame načítanie stránky

## Čo ďalej?

- Breadcrumb schema pre blog posty
- Blog post series schema (isPartOf)
- Lazy loading pre obrázky pod foldom
