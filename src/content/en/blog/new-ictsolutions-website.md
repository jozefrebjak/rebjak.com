---
title: 'The new ICT Solutions website: from GitHub Pages to our own VM'
description: 'I replaced the old company site on Hugo and GitHub Pages with a new one on Astro, running in Docker on our VM. How it is built and how I moved the old URLs over.'
pubDate: 2026-11-25T11:04:00
tags: ['astro', 'tailwind', 'docker', 'traefik', 'github-actions', 'nginx', 'seo']
draft: false
lang: en
---

The old [ICT Solutions](https://ictsolutions.net) website ran on Hugo 0.114 on GitHub Pages. English was the main language, Slovak lived under `/sk/`. The copy was last changed in March 2024, and the demo content from the theme was still there in both languages.

Before AI, company websites were often built exactly like this: buy a theme, rewrite the copy and leave the rest as it was. Today I have the feeling that's no longer the case, because a custom site can be built much faster than it used to be.

On top of that, we had it twice: two repos with the same history, one for `ictsolutions.net` and one for `ictsolutions.sk`, each with its own deploy.

The first commit of the new site is from 5 July, and it went to production on 24 November. Even with AI it took almost five months. I wanted the details right, not another site that looks like every other one generated with AI.

## What I wanted

### Slovak first

We're based in Košice and want to reach businesses in the region too, so Slovak is the main language. English sits next to it for our clients abroad, whom we also work with closely.

### One repo, one domain

With two repos holding the same content, every change had to land in both, and Google saw two identical sites on two domains. `.net` is the main domain, where our email lives too, and `.sk` just redirects to it.

### The form goes straight to the helpdesk

The contact form creates a ticket in our helpdesk. A message can't get lost in someone's inbox, and the team sees it in the same place as every other request.

### No cookie banner

A cookie banner isn't required on every website. Consent is needed when a site stores or reads data in the browser that isn't necessary for the site to work, typically analytics and advertising cookies. If the analytics don't use cookies and there are no third-party advertising or tracking scripts, you don't need the banner.

### Hosted by us

GitHub Pages wasn't enough for several reasons. It only serves static files, but the form needs a backend. A site on Pages can only have one custom domain, so `.sk` would have meant a second repo again. And Pages can't do custom 301 redirects, which we needed for the old URLs. On our VM, Traefik and nginx handle all of that.

## What's on the site

The homepage is one long page: services, why us, partners, certifications, FAQ and contact. If you just want to find out quickly what we do, you don't have to click anywhere.

Each of the eight services also has its own page under `/sluzby/` (`/en/services/` in English), from outsourcing through networking and security to 3CX and IT audits. Its own page means its own title and description, so Google can find each service separately.

On IT company websites I often see logos of Cisco, Microsoft, Fortinet and other vendors lined up side by side. But most vendors don't allow partners to use their corporate logo. Only the partner badge the vendor issues itself is allowed, and only for an actual partnership. So many of those sites break the vendors' terms, and the logos don't tell the visitor anything anyway.

That's why our site has only three partner cards: Microsoft, ESET and 3CX. Each one says what the partnership gives the customer and links to the vendor's partner directory, where they can check it. Other brands we work with are only mentioned in the text.

The ISO 9001 and 27001 certificates open right on the page in a PDF viewer. Contact has its own page with the form, billing details and a map from OpenStreetMap instead of Google Maps.

## Design

I started with Claude Design. Based on the company's 2024 brand manual, it put together a first draft and a design system: colours, typography, corner radii and shadows. I moved those values into Tailwind as tokens in `@theme`, and they apply across the whole site.

We rewrote the pages themselves anyway. The hero, header, navigation and buttons went through several rounds. Claude Design only sets the design up roughly, it doesn't give you a finished website. What it did help with was getting started and setting the boundaries we then worked within.

## Stack

The site is built with Astro 7 and Tailwind v4. The build produces static HTML served by nginx. I use the same stack for this blog.

I didn't pick Tailwind because AI likes to use it. On a marketing site you spend a lot of time fine-tuning the look, and with Tailwind you can adjust it exactly the way you want, right in the component, without hunting through CSS files. Astro adds static output and JavaScript only where it's really needed.

It also mattered that the site can be maintained without AI. It's ordinary Astro and Tailwind code that can be read and edited by hand. AI helps with changes, but the site doesn't depend on it. I didn't want code that only the tool that generated it understands. When the tool changes or a new colleague joins, someone who knows Astro and Tailwind has to be able to edit the site without first deciphering what AI once wrote there.

We didn't want a CMS. We manage everything through git and edit the site ourselves, not a marketer who doesn't know code. The copy lives in the repo along with the code.

Slovak is at `/`, English at `/en`, linked with hreflang. On the first visit the site opens in the browser's language: Slovak or Czech goes to SK, everything else to EN. If someone switches the language manually, the site remembers it. Crawlers aren't redirected, so Google indexes both versions.

We use FreeScout as our helpdesk, which we run ourselves and which has an API. So the contact form doesn't send an email. Instead, a small `contact-api` in Node creates a ticket in FreeScout directly, after checking Cloudflare Turnstile first. The FreeScout API key and the Turnstile secret key live only in this container.

Analytics run on Umami, which sits on the same VM behind Traefik. It works without cookies, which is why the site has no cookie banner. Fonts are self-hosted.

The site also has a blog. Social media images are generated with Satori, and search is handled by Pagefind, which indexes the finished HTML at build time.

## Deploy

<div class="diagram-zoom">
  <img class="diagram-light" src="/images/ictsolutions-architecture-en-light.svg" alt="ictsolutions.net architecture: GitHub repo, GitHub Actions and GHCR, self-hosted runner, Traefik, nginx, contact-api and Umami on our VM, FreeScout and Cloudflare Turnstile" />
  <img class="diagram-dark" src="/images/ictsolutions-architecture-en-dark.svg" alt="ictsolutions.net architecture: GitHub repo, GitHub Actions and GHCR, self-hosted runner, Traefik, nginx, contact-api and Umami on our VM, FreeScout and Cloudflare Turnstile" />
</div>

The site runs in Docker behind Traefik on our VM. Traefik handles certificates through a DNS-01 challenge against our PowerDNS.

GitHub Actions does the deploys. Images are built on a GitHub runner, and the deploy is done by a self-hosted runner on that same VM:

```text
push to develop        → image :edge   → preview.ictsolutions.net
GitHub release vX.Y.Z  → image :X.Y.Z  → ictsolutions.net
```

Production always runs a specific version, never `:latest`. Preview and production share one VM, each in its own compose project.

## Moving over from the old site

Traefik redirects `ictsolutions.sk`, `www` and `http` with a 301 to `https://ictsolutions.net`, keeping the path. That made the second repo unnecessary, and both old repos are archived.

nginx redirects the old URLs to the new pages. Slovak pages lived under `/sk/` and English ones at the root, so for example `/sk/contact/` goes to `/kontakt/` and `/contact/` to `/en/contact/`. The theme's demo content (projects, tags, authors) goes to the homepage.

The PDFs from the old site are redirected too, because search results still linked to them. Some had spaces and diacritics in their names. nginx matches the decoded URI, so the config has the names written exactly as they are:

```nginx
location = "/ICT_Povinné informovanie 2023.pdf" { return 301 /ochrana-osobnych-udajov/; }
```

After launch, Google still had old URLs such as `www.ictsolutions.net/about/` and `/service/` in its index. I added the domain to Search Console, submitted `sitemap-index.xml` and checked that the old URLs return a 301. Now it's a matter of waiting for Google to crawl the site again.

---

The site is at [ictsolutions.net](https://ictsolutions.net). If something doesn't work there, message me on [LinkedIn](https://www.linkedin.com/in/jozefrebjak/).
