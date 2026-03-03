# rebjak.com

Personal website of Jozef Rebjak — DevOps engineer.

**Live:** [rebjak.com](https://rebjak.com)

## Stack

- [Astro 5](https://astro.build) + TypeScript (strict)
- [Tailwind CSS v4](https://tailwindcss.com)
- GitHub Pages + GitHub Actions

## Features

- Bilingual — SK (default) and EN (`/en`)
- Dark mode without flash (inline script in `<head>`)
- Blog via Astro Content Collections (markdown)
- Static output — zero backend

## Structure

```
src/
  components/         Header, Footer, ThemeToggle
  content/
    sk/blog/          Slovak blog posts
    en/blog/          English blog posts
  i18n/               Translations and routing helpers
  layouts/            BaseLayout
  pages/              SK pages (/, /blog, /cv, /portfolio)
  pages/en/           EN pages (/en, /en/blog, /en/cv, /en/portfolio)
  styles/global.css
.github/workflows/deploy.yml
```

## Development

```sh
npm install
npm run dev       # localhost:4321
npm run build     # production build → ./dist
npm run preview   # preview build locally
```

## Deploy

Automatic via GitHub Actions on every push to `main` — builds and deploys to GitHub Pages.
