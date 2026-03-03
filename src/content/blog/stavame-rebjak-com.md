---
title: 'Stavíame rebjak.com od nuly'
description: 'Prečo som sa rozhodol postaviť vlastný web, čo som vybral za stack a ako celý proces prebiehal. Building in public, prvý diel.'
pubDate: 2026-03-03
tags: ['astro', 'tailwind', 'webdev', 'building-in-public']
lang: sk
---

Každý by mal mať vlastný kút na internete. Ja som ho roky odkladal. Dnes to meníme.

## Prečo teraz?

Pracujem v oblasti NetDevOps — správam siete, servery, Linux infraštruktúru a píšem kód, ktorý to celé drží pokope. Za tie roky som sa naučil kopec vecí, riešil zaujímavé problémy a nenašiel som nikde miesto, kde by som si to všetko poriadne zapísal.

Chcel som teda niečo vlastné:
- **Blog** — kde môžem písať o sieťach, Linuxe, automatizácii a nástrojoch
- **Portfólio** — projekty a veci, na ktorých pracujem
- **CV** — digitálna verzia životopisu
- **Dvojjazyčnosť** — SK a EN, pre istotu aj pre zahraničné príležitosti
- **Dark mode** — samozrejmosť

## Prečo Astro?

Skúmal som možnosti. WordPress — nie. Next.js — výkonný, ale overkill pre statický web. Hotová šablóna — nie, chcel som niečo vlastné.

**Astro** vyhralo z niekoľkých dôvodov:

- **Zero JS by default** — statická HTML, JavaScript len tam kde treba. Pre blog s dark mode togglem a jazykovým prepínačom ideálne.
- **Content Collections** — type-safe správa markdown súborov priamo v repe
- **Natívne i18n routing** — SK/EN bez externých knižníc
- **GitHub Pages deploy** — zadarmo, jednoducho, bez serverov

Stack je zámerne jednoduchý:

```
Astro 5 + TypeScript (strict)
Tailwind CSS v4
GitHub Pages + GitHub Actions
```

Žiadny headless CMS, žiadny state management. Obsah sú markdown súbory priamo v repe — verzionovateľné, prenosné, jednoduché.

## Štruktúra

```
/          → o mne, hero
/cv        → pracovné skúsenosti, technológie
/portfolio → projekty a nástroje
/blog      → tento blog
```

Každá sekcia existuje v SK aj EN variante — SK je default (bez prefixu), EN je na `/en`.

## Dark mode bez flashu

Klasický problém: ak dark mode riešiš cez CSS alebo JS hydráciu, pri načítaní stránky preblikne svetlý mód.

Riešenie je inline `<script>` v `<head>`, ktorý beží ešte pred renderom:

```js
(function () {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();
```

Tailwind dostane `dark` class na `<html>` skôr ako sa čokoľvek vykreslí. Žiadny flash.

## Deploy

GitHub Actions pri každom push do `main`:
1. `npm ci`
2. `astro build` → statický output do `/dist`
3. Deploy na GitHub Pages

Celý pipeline trvá ~30 sekúnd.

## Čo ďalej?

Toto je len základ. Plánujem:
- RSS feed
- Sitemap a SEO
- Reálny obsah CV a portfólia
- Články o sieťach, Linuxe a automatizácii

**Building in public** — píšeme spolu.

---

*Zdrojový kód je na [GitHub](https://github.com/jozefrebjak/rebjak.com).*
