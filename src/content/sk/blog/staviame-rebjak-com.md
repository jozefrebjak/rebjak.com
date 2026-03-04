---
title: 'Staviame rebjak.com od nuly'
description: 'Prečo som sa rozhodol postaviť vlastný web, aký stack som zvolil a ako celý proces prebiehal. Building in public, prvý diel.'
pubDate: 2026-03-03T10:00:00
tags: ['astro', 'tailwind', 'webdev', 'building-in-public']
lang: sk
---

Dlho som chcel miesto, kde si môžem veci poriadne zapísať. Tu to je.

## Prečo práve teraz?

Pracujem v oblasti IT — kde spravujem siete, servery, linuxovú infraštruktúru a píšem kód, ktorý to všetko drží pokope. Za tie roky som sa naučil veľa vecí, riešil zaujímavé problémy a nikdy som nemal miesto, kde by som si to všetko poriadne zapísal.

Chcel som teda niečo vlastné:

- **Blog** — kde môžem písať o sieťach, Linuxe, automatizácii a nástrojoch
- **Portfólio** — projekty a veci, na ktorých pracujem
- **CV** — digitálna verzia životopisu
- **Dvojjazyčnosť** — slovensky aj anglicky, lebo prečo nie
- **Dark mode** — samozrejmosť

## Prečo Astro?

Skúmal som možnosti. WordPress — nie. Next.js — výkonný, ale zbytočne komplexný pre statický web. Hotová šablóna — nie, chcel som niečo vlastné.

**Astro** vyhralo z niekoľkých dôvodov:

- **Zero JS by default** — statické HTML, JavaScript len tam, kde je skutočne potrebný. Pre blog s prepínačom témy a jazykovým prepínačom je to ideálne.
- **Content Collections** — type-safe správa markdown súborov priamo v repozitári
- **Natívne i18n routing** — podpora viacerých jazykov bez externých knižníc
- **GitHub Pages** — bezplatný hosting, jednoduché nastavenie

Stack je zámerne jednoduchý:

```
Astro 5 + TypeScript (strict)
Tailwind CSS v4
GitHub Pages + GitHub Actions
```

Žiadny headless CMS, žiadna správa stavu. Obsah sú markdown súbory priamo v repozitári — verziovateľné, prenosné, jednoduché.

## Štruktúra

```
/          → o mne, hero
/cv        → pracovné skúsenosti, technológie
/portfolio → projekty a nástroje
/blog      → tento blog
```

Každá sekcia existuje v slovenskej aj anglickej verzii — slovenčina je predvolená, angličtina na `/en`.

## Dark mode bez bliknutia

Sám používam dark mode všade, takže prebliknutie svetlého režimu pri načítaní stránky jednoducho nešlo.

Riešenie: inline `<script>` priamo v `<head>`, ktorý sa spustí ešte pred vykreslením stránky. Prečíta `localStorage` a systémovú preferenciu — ak treba dark, pridá triedu `dark` na `<html>` okamžite.

```js
(function () {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();
```

Tailwind `dark:` utility triedy dostanú kontext skôr, ako prehliadač vykreslí čokoľvek. Žiadne bliknutie.

## Deploy

GitHub Actions pri každom pushu do vetvy `main`:

1. `npm ci`
2. `astro build` → statický výstup do `/dist`
3. Deploy na GitHub Pages

Celý pipeline trvá zhruba 30 sekúnd.

## Čo ďalej?

Toto je len základ. Plánujem pridať:

- RSS feed
- Sitemap a SEO metadáta
- Projekty v portfóliu
- Články o sieťach, Linuxe a automatizácii

**Building in public** — píšeme spolu.

---

*Zdrojový kód je dostupný na [GitHub](https://github.com/jozefrebjak/rebjak.com).*
