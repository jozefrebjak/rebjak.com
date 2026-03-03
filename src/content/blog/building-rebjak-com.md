---
title: 'Building rebjak.com from scratch'
description: 'Why I decided to build my own website, what stack I chose and how the whole process went. Building in public, episode one.'
pubDate: 2026-03-03
tags: ['astro', 'tailwind', 'webdev', 'building-in-public']
lang: en
---

Every developer should have their own corner of the internet. I kept putting it off for years. Today that changes.

## Why now?

I had the domain `rebjak.com` sitting there with no content. I knew I wanted something clean, fast and easy to maintain — without unnecessary complexity. No WordPress, no ready-made template, no all-in-one builder.

I wanted:
- **Blogging** — to write about things I learn
- **Portfolio** — to showcase projects I work on
- **CV** — a digital version of my resume
- **Bilingual support** — SK and EN, just in case for international opportunities
- **Dark mode** — non-negotiable

## Why Astro?

I looked at the options:

- **Next.js** — powerful, but overkill for a static blog. Server components, client hydration — I don't need any of that.
- **Nuxt** — similar to Next, Vue ecosystem. I like Vue, but again — overkill.
- **Eleventy / Hugo** — great for blogs, but weaker DX and ecosystem.
- **Astro** — the winner. Why?

Astro has a "zero JS by default" philosophy. Every page is static HTML, JavaScript is only sent where you actually need it. For a blog with a dark mode toggle and language switcher, this is ideal.

Add to that:
- Native **Content Collections** support with type-safe schema
- Built-in **i18n routing** — no external packages
- One-command **Tailwind CSS v4** integration
- Output ready for **GitHub Pages** with no servers needed

Clear choice.

## Stack

```
Astro 5 + TypeScript (strict)
Tailwind CSS v4
GitHub Pages (deployed via GitHub Actions)
```

No additional dependencies. No state management, no headless CMS (for now). Content lives directly in markdown files in the repo.

## Structure

The site has four main sections:

```
/          → about me, hero, quick links
/cv        → work experience, education, skills
/portfolio → projects
/blog      → this blog
```

Each section exists in both SK and EN variants:
- `/` and `/blog` → Slovak (default)
- `/en` and `/en/blog` → English

The language switcher in the navbar navigates to the equivalent page in the other language.

## Dark mode without flash

This is the classic problem: if you handle dark mode via CSS media query or JS hydration, there's a brief white flash when the page loads.

The solution: an inline `<script is:inline>` in `<head>` that runs before render:

```js
(function () {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (stored === 'dark' || (!stored && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();
```

Tailwind gets the `dark` class on `<html>` before anything renders. No flash.

## GitHub Pages deploy

Deployment runs via GitHub Actions. On every push to `main`:

1. Checkout the repository
2. `npm ci` — install dependencies
3. `astro build` — static output to `/dist`
4. Upload artifact and deploy to GitHub Pages

Configuration in `.github/workflows/deploy.yml`. The whole pipeline takes about 30 seconds.

## What's next?

This is just the foundation. In upcoming posts I plan to cover:

- Adding an RSS feed
- SEO optimization and sitemap
- Image lazy loading and optimization
- Maybe pulling portfolio projects directly from GitHub via API

**Building in public** — we're building this together.

---

*The full source code is available on [GitHub](https://github.com/jozefrebjak/rebjak.com).*
