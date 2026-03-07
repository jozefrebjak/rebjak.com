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

Lighthouse flagged several text elements where the text color didn't have sufficient contrast against the background. WCAG AA requires at least 4.5:1 for normal text and 3:1 for large text.

Problematic classes:

- `text-zinc-400` on white background — contrast ~3.3:1 (fail)
- `text-zinc-300` on white background — contrast ~2.2:1 (fail)
- `text-zinc-500 dark:text-zinc-500` — OK in light mode, but borderline

### Solution

I systematically went through the homepage (SK and EN), footer, and navigation:

| Element | Before | After |
|---------|--------|-------|
| Stats labels | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-500` |
| Nav card labels | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-500` |
| Nav card description | `text-zinc-500 dark:text-zinc-500` | `text-zinc-600 dark:text-zinc-400` |
| "open →" text | `text-zinc-300 dark:text-zinc-700` | `text-zinc-400 dark:text-zinc-600` |
| Footer text | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-500` |
| Terminal title bar | `text-zinc-400 dark:text-zinc-600` | `text-zinc-500 dark:text-zinc-500` |
| Hero description | `text-zinc-500 dark:text-zinc-500` | `text-zinc-600 dark:text-zinc-400` |

The principle: in light mode, shift text toward darker shades (zinc-500/600); in dark mode, toward lighter ones (zinc-400/500).

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

All three issues fixed in a single PR:

- **Fonts**: Page renders immediately, fonts load in the background
- **Contrast**: WCAG AA met for all text elements
- **Redirect**: No unnecessary 301, direct page load

## What's next?

- Breadcrumb schema for blog posts
- Blog post series schema (isPartOf)
- Lazy loading for below-the-fold images
