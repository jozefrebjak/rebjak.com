---
title: 'PageSpeed optimization and GitHub Pages limitations'
description: 'Lighthouse showed Performance 87 on mobile. Self-hosted fonts, WCAG contrast, trailing slash — and why GitHub Pages cache headers prevent reaching 100. Building in public, part four.'
pubDate: 2026-03-08T10:00:00
tags: ['astro', 'performance', 'building-in-public']
draft: true
---

The site has SEO at 100, Best Practices at 100 — but Performance at 87 and Accessibility at 94. Lighthouse clearly showed what needed fixing.

## Starting point

After running [PageSpeed Insights](https://pagespeed.web.dev/) on `rebjak.com/en`, I got:

| Metric | Score |
|--------|-------|
| Performance | 87 |
| Accessibility | 94 |
| Best Practices | 100 |
| SEO | 100 |

Four main issues:

1. **Render-blocking Google Fonts** — ~2000 ms savings available
2. **Insufficient color contrast** — WCAG AA failure
3. **Trailing slash redirect** — `/en` → `/en/` costs ~925 ms
4. **External font requests** — DNS + TLS handshake on every visit

## 1. Render-blocking fonts

### Problem

A standard `<link rel="stylesheet">` for Google Fonts blocks rendering of the entire page until the font CSS is downloaded. On slower connections, that means a white screen for an extra 1-2 seconds.

### Solution

First step — I replaced the render-blocking link with a non-blocking `preload` + `onload` swap pattern:

```html
<!-- Before: render-blocking -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter..." />

<!-- After: non-blocking -->
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

How it works:

- `preload` downloads the CSS in the background without blocking render
- `onload` switches `rel` to `stylesheet` after download, applying the fonts
- `this.onload=null` prevents repeated calls
- `<noscript>` provides a fallback when JavaScript is disabled

<div class="callout note">

**preconnect** opens a TCP + TLS connection to the font server before the browser even knows it will need the fonts. This saves ~100-200 ms on the first request.

</div>

This fixed the render-blocking issue, but fonts were still being downloaded from external servers. I'll come back to that in section 4.

## 2. Color contrast (WCAG)

### Problem

Lighthouse flagged several text elements where the text color didn't have sufficient contrast against the background. WCAG AA requires at least **4.5:1** for normal text and **3:1** for large text.

The first iteration fixed the worst cases, but a Lighthouse CLI test revealed that `zinc-500` (`#71717a`) on dark backgrounds still didn't reach 4.5:1. Similarly, `zinc-400` (`#a1a1aa`) on white has only 2.56:1.

### Tailwind zinc scale contrast ratios

| Color | Hex | vs white | vs dark bg (~#0f1319) |
|-------|-----|----------|----------------------|
| zinc-300 | `#d4d4d8` | 1.48:1 | — |
| zinc-400 | `#a1a1aa` | 2.56:1 | 5.63:1 |
| zinc-500 | `#71717a` | 4.83:1 | 3.97:1 |
| zinc-600 | `#52525b` | 7.73:1 | — |

### Solution

The correct pattern for secondary text: **`text-zinc-500 dark:text-zinc-400`** — both values meet 4.5:1 in their respective modes.

| Element | Before | After |
|---------|--------|-------|
| Stats labels | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-400` |
| Nav card labels | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-400` |
| "open →" text | `text-zinc-300 dark:text-zinc-700` | `text-zinc-500 dark:text-zinc-400` |
| Footer text + links | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-400` |
| Terminal title bar | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-400` |
| CV section headers | `text-zinc-400 dark:text-zinc-500` | `text-zinc-500 dark:text-zinc-400` |
| Blog tag counts | `text-zinc-400 dark:text-zinc-500` | `text-zinc-500 dark:text-zinc-400` |

For the terminal output on the homepage, I replaced inline `color:#64748b` (slate-500, 3.91:1 contrast on dark) with a CSS class that switches between dark and light modes:

```css
/* dark mode default */
.term-out { color: #94a3b8; }  /* slate-400 — 7.26:1 on dark */

/* light mode override */
:root:not(.dark) .term-out { color: #475569; }  /* slate-600 — 7.58:1 on white */
```

In total, **12 files** were updated — both homepages, Header, Footer, both CVs, blog listings (SK/EN), and blog tags (SK/EN).

## 3. Trailing slash redirect

### Problem

GitHub Pages defaults to redirecting `/en` to `/en/` via a 301 redirect. PageSpeed reported this as ~925 ms of unnecessary latency — the browser has to make an extra round-trip to the server.

### Solution

I set `trailingSlash: 'always'` in the Astro config:

```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://rebjak.com',
  trailingSlash: 'always',
  // ...
});
```

And updated all internal links across the project to include trailing slashes:

```html
<!-- Before -->
<a href="/en/blog">Blog</a>
<a href="/cv">CV</a>

<!-- After -->
<a href="/en/blog/">Blog</a>
<a href="/cv/">CV</a>
```

Same for dynamic links:

```astro
<!-- Before -->
<a href={`/blog/tag/${tag}`}>#{tag}</a>

<!-- After -->
<a href={`/blog/tag/${tag}/`}>#{tag}</a>
```

In total, I updated links across 12 files — homepages, blog lists, tag pages, slug pages, and the Header component navigation.

## 4. Self-hosting fonts

### Problem

Even after the preload optimization, fonts were still being downloaded from `fonts.googleapis.com` and `fonts.gstatic.com`. Each external request means:

- **DNS lookup** — the browser needs to resolve the domain to an IP address
- **TCP + TLS handshake** — a new connection for each server
- **No control over caching** — Google sets its own cache headers

On mobile (simulated slow 4G with 150 ms RTT), this adds hundreds of milliseconds on every first load.

Google Fonts serves Inter as a variable font weighing **230 KB** and JetBrains Mono at **56 KB** — totaling **286 KB** over external servers.

### Solution

I downloaded the fonts and subsetted them using `pyftsubset` (from the `fonttools` library) to Latin + Latin Extended-A (U+0000-017F) — covering both English and Slovak (č, š, ž, ľ, ď, ť, ň and more).

```bash
pyftsubset inter-latin.woff2 \
  --output-file=inter-latin.woff2 \
  --flavor=woff2 \
  --layout-features='kern,liga,clig,calt' \
  --unicodes="U+0000-017F,U+2000-206F,U+20AC"
```

The resulting sizes:

| Font | Before (Google) | After (subset) | Savings |
|------|----------------|----------------|---------|
| Inter | 230 KB | 45 KB | –80% |
| JetBrains Mono | 56 KB | 32 KB | –43% |
| **Total** | **286 KB** | **77 KB** | **–73%** |

In `global.css`, I added `@font-face` declarations:

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

And in `BaseLayout.astro`, I replaced all Google Fonts links with simple `preload` declarations:

```html
<!-- Before: 4 links to external servers -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?..." onload="..." />
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?..." /></noscript>

<!-- After: 2 preload links to own server -->
<link rel="preload" as="font" type="font/woff2" href="/fonts/inter-latin.woff2" crossorigin />
<link rel="preload" as="font" type="font/woff2" href="/fonts/jetbrains-mono-latin.woff2" crossorigin />
```

<div class="callout tip">

**font-display: swap** shows text immediately with a fallback font (system-ui) and switches to Inter/JetBrains Mono once loaded. The user sees content right away — the font swap happens without noticeable flashing.

</div>

## Result

<details>
<summary>How to test locally</summary>

```bash
# build + serve
npx astro build && npx serve dist -l 4444

# in a second terminal
npx lighthouse http://localhost:4444/en/ \
  --chrome-flags="--headless=new" \
  --output=html \
  --output-path=./lighthouse-report.html
```

</details>

### Local (localhost)

| Page | Performance | Accessibility | Best Practices | SEO |
|------|-------------|---------------|----------------|-----|
| `/` (SK) | 100 | 100 | 100 | 100 |
| `/en/` (EN) | 100 | 100 | 100 | 100 |
| `/blog/` | 100 | 100 | 100 | 100 |
| `/en/blog/` | 100 | 100 | 100 | 100 |

### Production (GitHub Pages)

A local 100 isn't the full story. Lighthouse on the production server tests with real network latency — and the mobile preset simulates **slow 4G** (1.6 Mbps, 150 ms RTT).

Before self-hosting fonts, production looked like this:

| Preset | Performance | Accessibility | Best Practices | SEO |
|--------|-------------|---------------|----------------|-----|
| Desktop | 97 | 100 | 100 | 100 |
| Mobile | 87 | 100 | 100 | 100 |

After self-hosting and subsetting:

| Preset | Performance | Accessibility | Best Practices | SEO |
|--------|-------------|---------------|----------------|-----|
| Desktop | **100** | 100 | 100 | 100 |
| Mobile | **94–95** | 100 | 100 | 100 |

Desktop is at **100**. Mobile jumped from 87 to **94–95** — FCP dropped from 3.0 s to 1.0 s. That's a massive improvement, but still not 100. Why?

## Why mobile isn't 100 in production

The Lighthouse mobile preset isn't just a test — it simulates real-world conditions that many people face on slower mobile connections. And there are plenty of them: according to Google's [Think with Google](https://www.thinkwithgoogle.com/marketing-strategies/app-and-mobile/mobile-page-speed-new-industry-benchmarks/), **53% of mobile visitors abandon a site that takes more than 3 seconds to load**.

### What we managed to optimize

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| First Contentful Paint | 3.0 s | **1.0 s** | –67% |
| Largest Contentful Paint | 3.0 s | **2.7 s** | –10% |
| Speed Index | 4.4 s | **3.7 s** | –16% |
| Total Blocking Time | 0 ms | 0 ms | — |
| Cumulative Layout Shift | 0 | 0 | — |

FCP dropped to a third of the original — that directly means the user sees content almost instantly. TBT 0 and CLS 0 mean the page is immediately functional once loaded and nothing jumps around.

### What still holds it back: GitHub Pages limitations

GitHub Pages has hard limits you can't work around:

**Cache headers** — GitHub Pages sets `Cache-Control: max-age=600` (10 minutes) for **all** static assets. Even for files with hashed names (e.g. `_page_.DYzwY8gP.css`) that should ideally have `max-age=31536000` (1 year) with the `immutable` flag. You have no control over this — GitHub Pages doesn't support custom cache headers.

**No edge caching** — content is served from a single region. CDNs like Cloudflare or Vercel have edge nodes worldwide and serve from the closest server.

**No compression control** — you can't configure Brotli compression instead of gzip, or optimize response headers.

These are the factors costing the remaining 5–6 points. On localhost (zero latency) everything is 100/100 — the production penalty is purely network-related.

### Optimization summary

| Optimization | Impact | Status |
|-------------|--------|--------|
| Self-hosting fonts | Eliminates 3 external requests | Done |
| Font subsetting | –73% font size (286 → 77 KB) | Done |
| Trailing slash fix | Eliminates 301 redirect (~925 ms) | Done |
| Non-blocking font loading | Eliminates render-blocking CSS | Done |
| WCAG contrast (dark + light) | 100% Accessibility | Done |
| CDN (Cloudflare/Vercel) | Edge caching, longer cache, Brotli | Consider |
| Inline critical CSS | Eliminates render-blocking Astro CSS | Consider |

<div class="callout note">

For a static site on GitHub Pages, **Performance 94–95 on mobile** is a very solid result. The page loads in ~1 second to first paint and ~2.7 s fully on simulated slow 4G. No JavaScript blocks interaction, no layout shift.

The last 5–6 points to 100 would come from a CDN with edge caching and longer cache headers — that's an infrastructure decision, not a code one.

</div>

## What's next?

- Breadcrumb schema for blog posts
- Blog post series schema (isPartOf)
- Lazy loading for below-the-fold images
