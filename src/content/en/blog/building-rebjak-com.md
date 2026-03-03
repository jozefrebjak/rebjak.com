---
title: 'Building rebjak.com from scratch'
description: 'Why I decided to build my own website, what stack I chose and how the whole process went. Building in public, episode one.'
pubDate: 2026-03-03
tags: ['astro', 'tailwind', 'webdev', 'building-in-public']
lang: en
---

I've wanted a place to properly write things down for a long time. Here it is.

## Why now?

I work in NetDevOps — managing networks, servers, Linux infrastructure and writing code that holds it all together. Over the years I've learned a lot, solved interesting problems and never had a proper place to write any of it down.

So I wanted something of my own:

- **Blog** — to write about networks, Linux, automation and tools
- **Portfolio** — projects and things I'm working on
- **CV** — a digital version of my resume
- **Bilingual** — Slovak and English, why not
- **Dark mode** — non-negotiable

## Why Astro?

I looked at the options. WordPress — no. Next.js — powerful, but overkill for a static site. A ready-made template — no, I wanted something my own.

**Astro** won for several reasons:

- **Zero JS by default** — static HTML, JavaScript only where needed. Ideal for a blog with a dark mode toggle and language switcher.
- **Content Collections** — type-safe markdown file management directly in the repo
- **Native i18n routing** — multi-language support without external packages
- **GitHub Pages** — free hosting, simple setup

The stack is intentionally minimal:

```
Astro 5 + TypeScript (strict)
Tailwind CSS v4
GitHub Pages + GitHub Actions
```

No headless CMS, no state management. Content is markdown files directly in the repo — versionable, portable, simple.

## Structure

```
/          → about me, hero
/cv        → work experience, technologies
/portfolio → projects and tools
/blog      → this blog
```

Each section exists in both Slovak and English — Slovak is the default, English at `/en`.

## Dark mode without flash

I use dark mode everywhere, so a white flash on page load simply wasn't an option.

The fix: an inline `<script>` directly in `<head>` that runs before the page renders. It reads `localStorage` and the system preference — if dark mode is needed, it adds the `dark` class to `<html>` immediately.

```js
(function () {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();
```

Tailwind `dark:` utilities get their context before the browser renders anything. No flash.

## Deploy

GitHub Actions on every push to `main`:

1. `npm ci`
2. `astro build` → static output to `/dist`
3. Deploy to GitHub Pages

The whole pipeline takes ~30 seconds.

## What's next?

This is just the foundation. I'm planning:

- RSS feed
- Sitemap and SEO metadata
- Projects in the portfolio
- Articles about networks, Linux and automation

**Building in public** — let's build this together.

---

*Source code on [GitHub](https://github.com/jozefrebjak/rebjak.com).*
