---
title: 'Analytics, sitemap and RSS — going public'
description: 'I added Umami analytics, sitemap, robots.txt and RSS feeds to the site. Privacy-first tracking, zero cookie banners. Building in public, episode two.'
pubDate: 2026-03-04
tags: ['astro', 'analytics', 'umami', 'seo', 'building-in-public']
---

The site is live. Now I want to know if anyone is reading it — and make sure they can actually find it.

## The problem

After shipping the first version I had a clean minimalist site, but zero visibility into traffic. No signals for search engines either — no `robots.txt`, no sitemap, no RSS.

Three things to fix:

1. **Analytics** — who visited, from where, what they read
2. **Discoverability** — so Google and others know what's here
3. **RSS** — for readers who subscribe to blogs

## Analytics: why Umami?

Google Analytics is the de facto standard, but I didn't want it here. Reasons:

- **Cookies** — GA requires a cookie consent banner. For a blog with a handful of posts, that's just noise.
- **Privacy** — data goes to Google, not me.
- **Bloat** — the GA script is heavy and slows down page loads.

**[Umami](https://umami.is/)** solves all three:

- No cookies → no consent banner
- GDPR-friendly by default
- One lightweight `<script>` tag
- Dashboard with pageviews, referrers, countries, devices

I went with **Umami Cloud** — free up to 100,000 pageviews a month, which is more than enough for a personal blog. Integration took literally one minute:

```html
<script
  defer
  src="https://cloud.umami.is/script.js"
  data-website-id="..."
></script>
```

The script goes into `<head>` in `BaseLayout.astro` — defined once, applies to the entire site.

## Sitemap: @astrojs/sitemap

Search engines need to know what pages exist. A sitemap tells them.

Astro has an official integration:

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

Every build now auto-generates `sitemap-index.xml`. All pages — both Slovak and English versions — are included. No manual maintenance.

## robots.txt

A simple file at `public/robots.txt` — allows crawlers and points them to the sitemap:

```
User-agent: *
Allow: /

Sitemap: https://rebjak.com/sitemap-index.xml
```

## RSS feed

A blog without RSS is half a blog. Anyone following more than a handful of sites uses a feed reader — and if you're not in it, you're easy to miss.

Via `@astrojs/rss`:

```bash
npm install @astrojs/rss
```

I created two endpoints — `/rss.xml` for the Slovak blog and `/en/rss.xml` for English. Each endpoint loads the right content collection, filters out drafts and returns valid RSS XML. A `<link rel="alternate">` in `<head>` lets browsers and feed readers detect it automatically.

## What does this give me?

- **Umami dashboard** — from day one I know how many people visited, where they came from and what they read. No cookies, no consent banner.
- **Sitemap** — Google and other search engines get a complete page list on every crawl.
- **robots.txt** — I explicitly tell crawlers they're welcome.
- **RSS** — readers can subscribe in their favourite reader.

The whole thing took about an hour and the site is now a significant step closer to what it should be — publicly accessible, measurable and subscribable.

## What's next?

- Real content in the portfolio
- Articles about Linux, development and automation
- Open Graph images for blog posts

**Building in public** — let's build this together.

---

*Source code on [GitHub](https://github.com/jozefrebjak/rebjak.com).*
