---
title: 'SEO pre Astro blog — OG obrázky, JSON-LD a noindex'
description: 'Ako som pridal dynamické Open Graph obrázky, Twitter card meta, JSON-LD štruktúrované dáta a noindex pre stránkovanie. Building in public, tretí diel.'
pubDate: 2026-03-07T22:00:00
tags: ['astro', 'seo', 'building-in-public']
draft: true
---

Web už má analytics, sitemap aj RSS. Teraz riešim, ako vyzerá, keď ho niekto zdieľa na sociálnych sieťach — a čo o ňom vie Google.

## Problém

Keď som zdieľal blog post na Reddit, zobrazil sa len holý link. Žiadny obrázok, žiadny popis. Google zas nevedel, že ide o blog článok s autorom a dátumom. A stránky stránkovania (`/blog/2`) zbytočne riedili crawl budget.

Tri veci na riešenie:

1. **Open Graph obrázky** — branded preview pri zdieľaní
2. **JSON-LD štruktúrované dáta** — rozšírené výsledky v Google
3. **noindex** — vyčistiť index od stránok bez unikátneho obsahu

## Dynamické OG obrázky

### Prečo nie statické?

Mohol som vytvoriť obrázky manuálne v Canva alebo Figma. Ale pri každom novom poste by som to musel opakovať — otvoriť editor, exportovať PNG, nahrať do repo.

### satori + sharp

[Satori](https://github.com/vercel/satori) od Vercelu konvertuje JSX-like štruktúru na SVG. [Sharp](https://sharp.pixelplumbing.com/) potom SVG → PNG. Celé to beží pri builde ako Astro API route.

```bash
npm install satori sharp
```

Jadro generátora v `src/lib/og.ts`:

```typescript
import satori from "satori";
import sharp from "sharp";

const interFont = readFileSync(join(process.cwd(), "src/lib/Inter-SemiBold.ttf"));

export async function generateOgImage({ title, date, tags }: OgOptions): Promise<Buffer> {
  const svg = await satori(
    { /* JSX-like štruktúra s flexbox layoutom */ },
    { width: 1200, height: 630, fonts: [{ name: "Inter", data: interFont }] },
  );
  return sharp(Buffer.from(svg)).png().toBuffer();
}
```

### Dizajn

OG obrázok má:
- Dark gradient pozadie s jemnými grid čiarami
- Gradient border po obvode (cyan → violet)
- Glow efekty v rohoch
- Branding `rebjak.com` s cyan bodkou hore
- Titulok s gradient accent čiarou
- Dátum a tag štítky dole

Takto vyzerá výsledok:

<img src="/blog/og/seo-og-images-json-ld.png" alt="Ukážka vygenerovaného OG obrázku" width="1200" height="630" loading="lazy" />

Dôležité: satori nepodporuje `.woff` fonty — treba `.ttf`. Stiahol som Inter SemiBold z Google Fonts CDN.

### Astro endpointy

Každá jazyková verzia má vlastný endpoint:

```
src/pages/blog/og/[slug].png.ts      → /blog/og/staviame-rebjak-com.png
src/pages/en/blog/og/[slug].png.ts   → /en/blog/og/building-rebjak-com.png
src/pages/og-default.png.ts          → /og-default.png (fallback)
```

`getStaticPaths` prechádza content collection a generuje PNG pre každý post pri builde.

### Napojenie na BaseLayout

```astro
<meta property="og:image" content={ogImage ?? new URL("/og-default.png", Astro.site).href} />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content={ogImage ?? new URL("/og-default.png", Astro.site).href} />
```

Každý blog post si vypočíta vlastnú URL:

```typescript
const ogImage = new URL(`/blog/og/${slug}.png`, Astro.site).href;
```

## JSON-LD štruktúrované dáta

Google Schema.org `BlogPosting` — pridané priamo do stránok blog postov:

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.data.title,
  description: post.data.description,
  image: ogImage,
  datePublished: post.data.pubDate.toISOString(),
  author: { "@type": "Person", name: "Jozef Rebjak", url: "https://rebjak.com" },
  url: canonicalUrl,
  inLanguage: "sk",
  keywords: post.data.tags,
};
```

V BaseLayout:

```astro
{jsonLd && (
  <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
)}
```

Google tak vie, že stránka je článok s konkrétnym autorom, dátumom a kľúčovými slovami. Môže zobraziť rozšírené výsledky v SERPe.

<div class="callout note">

**SERP** (Search Engine Results Page) je stránka výsledkov vyhľadávania. V praxi to znamená, že pri vašom článku v Google sa môže objaviť meno autora, dátum publikácie alebo obrázok — namiesto obyčajného modrého linku.

</div>

## noindex pre stránkovanie a tag stránky

Stránky ako `/blog/2`, `/blog/tag/astro` alebo `/blog/tags` sú navigačné — nemajú unikátny obsah. Keď ich Google indexuje, riedí crawl budget a vytvára duplicitný obsah bez pridanej hodnoty.

Riešenie je jednoduché — `noindex, follow`:

```astro
<!-- BaseLayout.astro -->
{noindex && <meta name="robots" content="noindex, follow" />}
```

- **Stránkovanie** (`[...page].astro`): `noindex={page.currentPage > 1}` — prvá strana sa indexuje, ďalšie nie
- **Tag stránky** (`tag/[tag].astro`): vždy `noindex`
- **Zoznam tagov** (`tags.astro`): vždy `noindex`

`follow` je dôležité — Google stále sleduje linky na týchto stránkach a objavuje nové články.

## RSS s OG obrázkami

Bonus: RSS feed teraz obsahuje `<enclosure>` s OG obrázkom pre každý článok:

```typescript
customData: `<enclosure url="${ogUrl}" type="image/png" length="0" />`,
```

RSS čítačky ako Feedly alebo Inoreader tak zobrazia obrázok pri každom článku.

## Výsledok

Po builde sa vygeneruje 11 PNG obrázkov (5 SK + 5 EN + 1 default), každý ~60-80 KB. Build trvá ~3 sekundy.

Čo sa zmenilo:
- Zdieľanie na Reddit/X/LinkedIn/Slack/Discord zobrazuje branded preview s titulkom
- Google rozumie štruktúre článkov (BlogPosting schéma)
- Index je čistý — len skutočný obsah, nie stránkovanie a tag stránky
- RSS čítačky zobrazujú obrázky

## Čo ďalej?

- Performance audit (Core Web Vitals)
- Breadcrumb schema
- Blog post series schema (isPartOf)
