---
title: 'Nový web ICT Solutions: z GitHub Pages na vlastnú VM'
description: 'Starý firemný web na Hugo a GitHub Pages som nahradil novým na Astro, ktorý beží v Dockeri na našej VM. Ako je postavený a ako som preniesol staré adresy.'
pubDate: 2026-11-25T11:04:00
tags: ['astro', 'tailwind', 'docker', 'traefik', 'github-actions', 'nginx', 'seo']
draft: false
lang: sk
---

Starý web [ICT Solutions](https://ictsolutions.net) bežal na Hugo 0.114 na GitHub Pages. Hlavná bola angličtina, slovenčina bola pod `/sk/`. Texty sa naposledy menili v marci 2024 a v oboch jazykoch zostal demo obsah zo šablóny.

Pred AI sa firemné weby často robili práve takto: kúpila sa šablóna, prepísali sa texty a zvyšok ostal tak, ako bol. Dnes mám dojem, že to už tak nie je, lebo web na mieru sa dá postaviť oveľa rýchlejšie ako kedysi.

Mali sme ho navyše dvakrát: dve repá s rovnakou históriou, jedno pre `ictsolutions.net` a jedno pre `ictsolutions.sk`, každé s vlastným deployom.

Prvý commit nového webu je z 5. júla, do produkcie išiel 24. novembra. Aj s AI to trvalo skoro päť mesiacov. Chcel som mať doladené detaily, nie ďalší web, ktorý vyzerá ako všetky ostatné vygenerované cez AI.

## Čo som chcel

### Slovenčina na prvom mieste

Sme z Košíc a chceme osloviť aj firmy v okolí, preto je hlavný jazyk slovenčina. Angličtina je vedľa nej pre zahraničných klientov, s ktorými tiež úzko spolupracujeme.

### Jedno repo, jedna doména

Pri dvoch repách s rovnakým obsahom sa každá zmena musela dostať do oboch a Google videl dva rovnaké weby na dvoch doménach. Hlavná je `.net`, na ktorej máme aj e-maily, a `.sk` na ňu len presmeruje.

### Formulár rovno do helpdesku

Kontaktný formulár vytvorí tiket v helpdesku. Správa sa tak nestratí v niečej schránke a tím ju vidí na rovnakom mieste ako všetky ostatné požiadavky.

### Bez cookie lišty

Cookie lišta nie je povinná na každom webe. Súhlas treba vtedy, keď web ukladá alebo číta v prehliadači údaje, ktoré nie sú nevyhnutné na jeho fungovanie, typicky analytické a reklamné cookies. Keď analytika cookies nepoužíva a na webe nie sú reklamné ani sledovacie skripty tretích strán, lištu netreba.

### Hosting u nás

GitHub Pages nestačili z viacerých dôvodov. Vedia len statické súbory, ale formulár potrebuje backend. Jeden web na Pages môže mať len jednu vlastnú doménu, takže pre `.sk` by sme znova potrebovali druhé repo. A Pages nevedia ani vlastné 301 presmerovania, ktoré sme potrebovali pre staré adresy. Na našej VM toto všetko riešia Traefik a nginx.

## Čo je na webe

Úvodná stránka je jedna dlhá stránka: služby, prečo my, partneri, certifikáty, časté otázky a kontakt. Kto chce len rýchlo zistiť, čo robíme, nemusí nikam klikať.

Každá z ôsmich služieb má aj vlastnú stránku pod `/sluzby/`, od outsourcingu cez siete a bezpečnosť po 3CX a IT audit. Vlastná stránka má vlastný titulok a popis, takže Google vie každú službu nájsť zvlášť.

Na weboch IT firiem často vidím vedľa seba logá Cisco, Microsoftu, Fortinetu a ďalších výrobcov. Lenže väčšina výrobcov partnerom svoje firemné logo používať nedovoľuje. Povolený je len partnerský odznak, ktorý výrobca sám vydá, a aj ten len pri skutočnom partnerstve. Veľa webov tak porušuje podmienky výrobcov a návštevníkovi tie logá aj tak nič nepovedia.

Na našom webe sú preto len tri partnerské karty: Microsoft, ESET a 3CX. Pri každej je napísané, čo partnerstvo dáva zákazníkovi, a odkaz na zoznam partnerov u výrobcu, kde si to môže overiť. Ostatné značky, s ktorými pracujeme, sú len v texte.

Certifikáty ISO 9001 a 27001 sa dajú otvoriť priamo na stránke v PDF prehliadači. Kontakt má vlastnú stránku s formulárom, fakturačnými údajmi a mapou z OpenStreetMap namiesto Google Maps.

## Dizajn

Na začiatku som použil Claude Design. Podľa firemného brand manuálu z roku 2024 pripravil prvý návrh a design system: farby, typografiu, zaoblenia a tiene. Tieto hodnoty som preniesol do Tailwindu ako tokeny v `@theme` a platia na celom webe.

Samotné stránky sme potom aj tak prepísali. Úvodnú sekciu, hlavičku, navigáciu aj tlačidlá sme prerábali niekoľkokrát. Claude Design dizajn nastaví len nahrubo, hotový web z neho nie je. Pomohol hlavne začať a určiť mantinely, v ktorých sa potom dalo pracovať.

## Stack

Web je postavený na Astro 7 a Tailwind v4. Build vygeneruje statické HTML, ktoré beží v nginx. Rovnaký stack používam aj na tomto blogu.

Tailwind som nevybral preto, že ho rado používa AI. Pri propagačnom webe sa veľa ladí vzhľad a s Tailwindom sa dá upraviť presne tak, ako chceme, priamo v komponente, bez hľadania v CSS súboroch. Astro k tomu dáva statický výstup a JavaScript len tam, kde je naozaj potrebný.

Dôležité bolo aj to, aby sa web dal spravovať bez AI. Je to bežný kód v Astre a Tailwinde, ktorý sa dá čítať a upravovať ručne. AI pri úpravách pomôže, ale web bez nej nestojí. Nechcel som mať kód, ktorému rozumie len nástroj, čo ho vygeneroval. Keď sa nástroj zmení alebo príde nový kolega, web musí vedieť upraviť človek, ktorý pozná Astro a Tailwind, bez toho, aby najprv lúštil, čo tam AI kedysi napísala.

CMS sme nechceli. Všetko spravujeme cez git a web upravujeme sami, nie marketér bez znalosti kódu. Texty sú v repe spolu s kódom.

Slovenčina je na `/`, angličtina na `/en`, prepojené cez hreflang. Pri prvej návšteve sa web otvorí v jazyku prehliadača: slovenčina alebo čeština ide na SK, ostatné na EN. Keď si niekto jazyk prepne ručne, web si to pamätá. Crawlery sa nepresmerúvajú, aby Google indexoval obe verzie.

Ako helpdesk používame FreeScout, ktorý bežíme sami a ktorý má API. Kontaktný formulár preto neposiela e-mail, ale cez malé `contact-api` v Node vytvorí rovno tiket vo FreeScoute. Predtým overí Cloudflare Turnstile. API kľúč k FreeScoutu aj tajný kľúč Turnstile sú len v tomto kontajneri.

Analytiku robí Umami, ktorý beží na tej istej VM za Traefikom. Funguje bez cookies, preto na webe nie je cookie lišta. Fonty sú self-hosted.

Na webe je aj blog. Obrázky pre sociálne siete sa generujú cez Satori a vyhľadávanie robí Pagefind, ktorý pri builde zaindexuje hotové HTML.

## Deploy

<div class="diagram-zoom">
  <img class="diagram-light" src="/images/ictsolutions-architecture-sk-light.svg" alt="Architektúra webu ictsolutions.net: GitHub repo, GitHub Actions a GHCR, self-hosted runner, Traefik, nginx, contact-api a Umami na našej VM, FreeScout a Cloudflare Turnstile" />
  <img class="diagram-dark" src="/images/ictsolutions-architecture-sk-dark.svg" alt="Architektúra webu ictsolutions.net: GitHub repo, GitHub Actions a GHCR, self-hosted runner, Traefik, nginx, contact-api a Umami na našej VM, FreeScout a Cloudflare Turnstile" />
</div>

Web beží v Dockeri za Traefikom na našej VM. Certifikáty rieši Traefik cez DNS-01 na našom PowerDNS.

Nasadzuje GitHub Actions. Image sa builduje na GitHub runneri, deploy robí self-hosted runner na tej istej VM:

```text
push do develop        → image :edge   → preview.ictsolutions.net
GitHub release vX.Y.Z  → image :X.Y.Z  → ictsolutions.net
```

V produkcii vždy beží konkrétna verzia, nie `:latest`. Preview a produkcia sú na jednej VM, každé vo vlastnom compose projekte.

## Prechod zo starého webu

`ictsolutions.sk`, `www` a `http` presmeruje Traefik cez 301 na `https://ictsolutions.net` aj s cestou. Druhé repo tým odpadlo a obe staré repá sú archivované.

Staré adresy presmeruje nginx na nové stránky. Slovenské boli pod `/sk/`, anglické na roote, takže napríklad `/sk/contact/` ide na `/kontakt/` a `/contact/` na `/en/contact/`. Demo obsah šablóny (projekty, tagy, autori) ide na úvodnú stránku.

Presmerované sú aj PDF zo starého webu, lebo na ne stále odkazovali výsledky vyhľadávania. Niektoré mali v názve medzery a diakritiku. nginx porovnáva dekódovanú URI, takže v configu sú názvy napísané tak, ako sú:

```nginx
location = "/ICT_Povinné informovanie 2023.pdf" { return 301 /ochrana-osobnych-udajov/; }
```

Po spustení mal Google v indexe ešte staré adresy ako `www.ictsolutions.net/about/` a `/service/`. Pridal som doménu do Search Console, poslal `sitemap-index.xml` a skontroloval, že staré adresy vracajú 301. Teraz sa čaká, kým Google web prejde znova.

---

Web je na [ictsolutions.net](https://ictsolutions.net). Ak tam niečo nefunguje, napíš mi na [LinkedIn](https://www.linkedin.com/in/jozefrebjak/).
