---
title: 'Analytics, sitemap a RSS — web ide do sveta'
description: 'Ako som pridal Umami analytics, sitemap, robots.txt a RSS feed. Prečo privacy-first tracking a čo mi to dáva. Building in public, druhý diel.'
pubDate: 2026-03-04T10:00:00
tags: ['astro', 'analytics', 'umami', 'seo', 'building-in-public']
---

Web beží. Teraz chcem vedieť, či ho niekto číta — a chcem, aby ho vedel niekto vôbec nájsť.

## Problém

Po nasadení prvej verzie som mal pekný minimalistický web, ale nulové informácie o návštevnosti. Zároveň neboli žiadne signály pre vyhľadávače — žiadny `robots.txt`, žiadna sitemap, žiadny RSS.

Tri veci na riešenie:

1. **Analytics** — kto navštívil, odkiaľ, čo čítal
2. **Discoverability** — aby Google a spol. vedeli, čo tu je
3. **RSS** — pre čitateľov, ktorí odoberajú blogy

## Analytics: prečo Umami?

Google Analytics je de facto štandard, ale nechcel som ho tu. Dôvody:

- **Cookies** — GA vyžaduje cookie consent banner. Pre blog so zopár článkami je to absurdné.
- **Privacy** — dáta idú Googlu, nie mne.
- **Bloat** — GA script je ťažký a spomaľuje načítanie.

**[Umami](https://umami.is/)** rieši všetky tri problémy:

- Bez cookies → žiadny consent banner
- GDPR-friendly by default
- Jeden ľahký `<script>` tag
- Dashboard s pageviews, referrers, krajinami, zariadeniami

Použil som **Umami Cloud** — zadarmo do 100 000 pageviews mesačne, čo pre osobný blog bohato stačí. Integrácia trvala doslova minútu:

```html
<script
  defer
  src="https://cloud.umami.is/script.js"
  data-website-id="..."
></script>
```

Script som dal do `<head>` v `BaseLayout.astro` — raz definovaný, platí pre celý web.

## Sitemap: @astrojs/sitemap

Vyhľadávače potrebujú vedieť, aké stránky existujú. Sitemap im to povie.

Astro má oficiálnu integráciu:

```bash
npm install @astrojs/sitemap
```

```js
// astro.config.mjs
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://rebjak.com',
  integrations: [sitemap()],
});
```

Pri každom builde sa automaticky vygeneruje `sitemap-index.xml`. Všetky stránky vrátane slovenských aj anglických verzií sú zahrnuté — bez manuálnej správy.

## robots.txt

Jednoduchý súbor v `public/robots.txt` — povolí crawlerov a odkáže ich na sitemap:

```
User-agent: *
Allow: /

Sitemap: https://rebjak.com/sitemap-index.xml
```

## RSS feed

Blog bez RSS je polovičný blog. Čitatelia, ktorí odoberajú desiatky blogov, používajú RSS čítačky — a ak tam nie si, jednoducho ťa minú.

Riešenie cez `@astrojs/rss`:

```bash
npm install @astrojs/rss
```

Vytvoril som dva endpointy — `/rss.xml` pre slovenský blog a `/en/rss.xml` pre anglický. Každý endpoint načíta príslušnú Content Collection, filtruje drafty a vráti validný RSS XML.

Do `<head>` v BaseLayout som pridal aj `<link rel="alternate">`, vďaka čomu prehliadače a RSS čítačky feed automaticky detegujú.

## Čo mi to dáva?

- **Umami dashboard** — od prvého dňa viem, koľko ľudí navštívilo web, odkiaľ prišli a čo čítali. Bez cookies, bez consent bannera.
- **Sitemap** — Google a ostatné vyhľadávače dostanú kompletný zoznam stránok pri každom crawle.
- **robots.txt** — explicitne hovorím crawlerom, že sú vítaní.
- **RSS** — čitatelia si môžu odoberať blog vo svojej obľúbenej čítačke.

Celé to zabralo asi hodinu práce a web je teraz o výrazný krok bližšie k tomu, čo má byť — verejne prístupný, merateľný a odoberateľný.

## Čo ďalej?

- Reálny obsah v portfóliu
- Články o Linuxe, vývoji a automatizácii
- Open Graph obrázky pre blog posty

**Building in public** — píšeme spolu.

---

*Zdrojový kód je dostupný na [GitHub](https://github.com/jozefrebjak/rebjak.com).*
