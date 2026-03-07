---
title: 'PageSpeed optimization — fonts, contrast and trailing slash'
description: 'Lighthouse showed Performance 87 and Accessibility 94. I fixed render-blocking fonts, insufficient color contrast and an unnecessary redirect. Building in public, part four.'
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

Three main issues:

1. **Render-blocking Google Fonts** — ~2000 ms savings available
2. **Insufficient color contrast** — WCAG AA failure
3. **Trailing slash redirect** — `/en` → `/en/` costs ~925 ms

## 1. Render-blocking fonts

### Problem

A standard `<link rel="stylesheet">` for Google Fonts blocks rendering of the entire page until the font CSS is downloaded. On slower connections, that means a white screen for an extra 1-2 seconds.

### Solution

I replaced the render-blocking link with a non-blocking `preload` + `onload` swap pattern:

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

## Result

Lighthouse CLI on a local build after all fixes:

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

| Page | Performance | Accessibility | Best Practices | SEO |
|------|-------------|---------------|----------------|-----|
| `/` (SK) | 100 | 100 | 100 | 100 |
| `/en/` (EN) | 100 | 100 | 100 | 100 |
| `/blog/` | 100 | 100 | 100 | 100 |
| `/en/blog/` | 100 | 100 | 100 | 100 |

From 87/94 to **100/100** — no compromises, just properly configured colors, fonts, and URLs.

## What's next?

- Breadcrumb schema for blog posts
- Blog post series schema (isPartOf)
- Lazy loading for below-the-fold images
