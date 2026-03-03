---
title: 'Stavíame rebjak.com od nuly'
description: 'Prečo som sa rozhodol postaviť vlastný web, čo som vybral za stack a ako celý proces prebiehal. Building in public, prvý diel.'
pubDate: 2026-03-03
tags: ['astro', 'tailwind', 'webdev', 'building-in-public']
lang: sk
---

Každý developer má mať vlastný kút na internete. Ja som ho roky odkladal. Dnes to meníme.

## Prečo teraz?

Mal som rozrobenú doménu `rebjak.com` bez obsahu. Vedel som, že chcem niečo čisté, rýchle a ľahko spravovateľné — bez zbytočnej komplexnosti. Žiadny WordPress, žiadna hotová šablóna, žiadny "all-in-one" builder.

Chcel som:
- **Blogovanie** — aby som mohol písať o veciach, ktoré sa učím
- **Portfólio** — ukázať projekty, na ktorých pracujem
- **CV** — digitálna verzia životopisu
- **Dvojjazyčnosť** — SK a EN, pre istotu aj pre zahraničné príležitosti
- **Dark mode** — samozrejmosť

## Prečo Astro?

Skúmal som možnosti:

- **Next.js** — výkonný, ale pre statický blog prehnané. Server components, client hydration — toto nepotrebujem.
- **Nuxt** — podobné ako Next, Vue ekosystém. Mám rád Vue, ale znova — overkill.
- **Eleventy / Hugo** — skvelé pre blogy, ale slabšia DX a ekosystém.
- **Astro** — víťaz. Prečo?

Astro má filozofiu "zero JS by default". Každá stránka je statická HTML, JavaScript sa pošle iba tam, kde ho naozaj potrebuješ. Pre blog s dark mode togglem a jazykovým prepínačom je to ideálne.

Pridaj k tomu:
- natívnu podporu **Content Collections** s type-safe schemou
- built-in **i18n routing** — žiadne externe balíčky
- integráciu s **Tailwind CSS v4** jedným príkazom
- výstup pre **GitHub Pages** bez serverov

Jasný výber.

## Stack

```
Astro 5 + TypeScript (strict)
Tailwind CSS v4
GitHub Pages (deploy cez GitHub Actions)
```

Žiadne ďalšie závislosti. Žiadny state management, žiadny headless CMS (zatiaľ). Obsah je priamo v markdown súboroch v repe.

## Štruktúra

Web má štyri hlavné sekcie:

```
/          → o mne, hero, rýchle linky
/cv        → pracovné skúsenosti, vzdelanie, zručnosti
/portfolio → projekty
/blog      → tento blog
```

Každá sekcia existuje v SK aj EN variante:
- `/` a `/blog` → slovensky (default)
- `/en` a `/en/blog` → anglicky

Prepínač jazyka v navbare prechádza na ekvivalentnú stránku v druhom jazyku.

## Dark mode bez flashu

Toto je klasický problém: ak dark mode riešiš cez CSS media query alebo hydráciu v JS, pri načítaní stránky chvíľu preblikne svetlý mód.

Riešenie: inline `<script is:inline>` v `<head>`, ktorý beží pred renderom:

```js
(function () {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();
```

Tailwind dostane class `dark` na `<html>` ešte pred tým, ako sa čokoľvek vykreslí. Žiadny flash.

## GitHub Pages deploy

Deploy beží cez GitHub Actions. Na každý push do `main`:

1. Checkout repozitára
2. `npm ci` — install závislostí
3. `astro build` — statický výstup do `/dist`
4. Upload artefaktu a deploy na GitHub Pages

Konfigurácia v `.github/workflows/deploy.yml`. Celý pipeline trvá asi 30 sekúnd.

## Čo ďalej?

Toto je len základ. V ďalších článkoch plánujem:

- Pridanie RSS feedu
- SEO optimalizácia a sitemap
- Lazy loading obrázkov a optimalizácia
- Možno pridanie projektu do portfólia priamo z GitHubu cez API

**Building in public** — budeme stavať spolu.

---

*Celý zdrojový kód webu je dostupný na [GitHub](https://github.com/jozefrebjak/rebjak.com).*
