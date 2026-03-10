---
title: docker-duoauthproxy
description: Kontajnerizovaný Duo Authentication Proxy s multi-arch buildmi, Trivy skenovaním a SBOM atestáciou.
category: docker
tags: ["Docker", "GitHub Actions", "Security", "CI/CD"]
url: https://github.com/ict-solutions-dev/docker-duoauthproxy/pkgs/container/duoauthproxy
source: https://github.com/ict-solutions-dev/docker-duoauthproxy
order: 1
---

## Čo to rieši

Duo Authentication Proxy je služba od Duo Security (Cisco), ktorá funguje ako prostredník medzi vašou lokálnou autentifikačnou infraštruktúrou (Active Directory, RADIUS) a cloud službou Duo. Umožňuje pridať dvojfaktorové overenie (2FA) k existujúcim VPN, SSH alebo webovým aplikáciám — bez zmeny v samotnej aplikácii.

Oficiálny Duo Authentication Proxy však nemá kontajnerovú distribúciu. Inštalácia vyžaduje manuálny build zo zdrojových kódov, konfiguráciu INI súborov a správu služby na hostiteľskom systéme. Tento Docker image to celé zjednodušuje na jeden `docker run` príkaz.

Image bol navrhnutý pre **Docker Swarm mode** — plná podpora Docker Secrets, health checky a možnosť škálovania replík bez zmeny konfigurácie.

## Autentifikačný flow

Typický nasadenie v sieti s FortiGate, FreeRADIUS a MariaDB:

<div class="diagram-zoom">
  <img class="diagram-light" src="/images/duo-auth-flow-light.svg" alt="Duo Authentication Proxy flow diagram" />
  <img class="diagram-dark" src="/images/duo-auth-flow-dark.svg" alt="Duo Authentication Proxy flow diagram" />
</div>

1. Klient sa pripája na **FortiGate** VPN s menom a heslom
2. FortiGate pošle RADIUS request na **Duo Auth Proxy**
3. Duo Auth Proxy overí heslo voči **FreeRADIUS** (ktorý autentifikuje cez **MariaDB**)
4. Po úspešnom overení hesla vyžiada 2FA cez **Duo Cloud** (push notifikácia, SMS, OTP)
5. Po schválení 2FA vráti RADIUS Accept späť na FortiGate

## Rýchly štart

```bash
docker run -d \
  --name duoauthproxy \
  -p 1812:1812/udp \
  -e RADIUS_HOST=10.10.10.2 \
  -e RADIUS_SECRET=radiussecret \
  -e DUO_IKEY=DIXXXXXXXXXXXXXXXXXX \
  -e DUO_SKEY=YourSecretKeyHere \
  -e DUO_API_HOST=api-XXXXXXXX.duosecurity.com \
  -e RADIUS_CLIENT_IP_1=192.168.1.10 \
  -e RADIUS_CLIENT_SECRET_1=clientsecret \
  ghcr.io/ict-solutions-dev/duoauthproxy:1.2.0-duo6.6.0
```

Celá konfigurácia prebieha cez **environment premenné** — žiadne manuálne editovanie konfiguračných súborov. Entrypoint skript pri štarte:

1. Načíta premenné (vrátane `_FILE` variantov pre Docker secrets)
2. Validuje vstupy — skontroluje povinné premenné, sekvenčné poradie hostov, povolené hodnoty
3. Vygeneruje `authproxy.cfg` z premenných
4. Otestuje konektivitu k Duo API
5. Spustí proxy daemon

## Konfigurácia cez environment premenné

Namiesto klasického INI súboru je celá konfigurácia ENV-first:

| Premenná | Popis |
| --- | --- |
| `RADIUS_HOST` | RADIUS server hostname alebo IP |
| `RADIUS_SECRET` | Zdieľaný kľúč k RADIUS serveru |
| `DUO_IKEY` | Duo integration key |
| `DUO_SKEY` | Duo secret key |
| `DUO_API_HOST` | Duo API hostname |
| `RADIUS_CLIENT_IP_1` | IP adresa prvého RADIUS klienta |
| `RADIUS_CLIENT_SECRET_1` | Zdieľaný kľúč prvého klienta |

Podporuje až **6 RADIUS serverov** a **6 klientov** cez číslované premenné (`RADIUS_HOST_2`, `RADIUS_CLIENT_IP_3`, ...).

Voliteľné premenné ako `RADIUS_FAILMODE` (safe/secure), `RADIUS_PASS_THROUGH_ATTRS` alebo `RADIUS_CLIENT_TYPE` (radius_client, ad_client, duo_only_client) umožňujú pokročilú konfiguráciu bez zásahu do konfiguračného súboru.

## Bezpečnosť

Bezpečnosť bola priorita od prvého commitu:

- **Non-root kontajner** — beží pod používateľom `duo` (UID/GID 35505), nie ako root
- **Docker Secrets podpora** — každá citlivá premenná podporuje `_FILE` suffix. Namiesto `-e RADIUS_SECRET=heslo` použijete `-e RADIUS_SECRET_FILE=/run/secrets/radius_secret` a secret sa načíta zo súboru. Ak nastavíte obe varianty, kontajner odmietne naštartovať
- **Redakcia v logoch** — entrypoint skript v štartovacom loge maskovuje všetky citlivé hodnoty
- **Trivy vulnerability scanning** — každý build sa skenuje na známe zraniteľnosti, výsledky sa nahrávajú do GitHub Security tabu
- **SBOM generovanie** — pri každom builde sa vytvorí Software Bill of Materials v SPDX formáte cez Anchore
- **Build provenance atestácia** — GitHub Attestations overujú, že image bol skutočne buildnutý v CI pipeline

```yaml
# Docker Compose s Docker Secrets
services:
  duoauthproxy:
    image: ghcr.io/ict-solutions-dev/duoauthproxy:1.2.0-duo6.6.0
    restart: unless-stopped
    ports:
      - "1812:1812/udp"
    environment:
      RADIUS_HOST: 10.10.10.2
      RADIUS_SECRET_FILE: /run/secrets/radius_secret
      DUO_IKEY_FILE: /run/secrets/duo_ikey
      DUO_SKEY_FILE: /run/secrets/duo_skey
      DUO_API_HOST: api-XXXXXXXX.duosecurity.com
      RADIUS_CLIENT_IP_1: 192.168.1.10
      RADIUS_CLIENT_SECRET_FILE: /run/secrets/radius_client_secret
    secrets:
      - radius_secret
      - duo_ikey
      - duo_skey
      - radius_client_secret

secrets:
  radius_secret:
    file: ./secrets/radius_secret.txt
  duo_ikey:
    file: ./secrets/duo_ikey.txt
  duo_skey:
    file: ./secrets/duo_skey.txt
  radius_client_secret:
    file: ./secrets/radius_client_secret.txt
```

## CI/CD pipeline

GitHub Actions workflow sa spúšťa pri push do `develop` vetvy, pri vytvorení tagu (`v*`) a manuálne. Pipeline:

1. **Lint** — Dockerfile sa kontroluje cez hadolint
2. **Build** — multi-arch image (`linux/amd64` + `linux/arm64`) cez Docker Buildx
3. **Push** — publikuje sa na GitHub Container Registry
4. **Scan** — Trivy skenuje zraniteľnosti
5. **SBOM** — generuje sa v SPDX formáte
6. **Atestácia** — build provenance cez GitHub Attestations

## Verziovanie

Image tag obsahuje obe verzie — projektu aj upstream Duo:

<div class="diagram-zoom">
  <img class="diagram-light" src="/images/duo-versioning-light.svg" alt="Schéma verziovania Docker image: verzia projektu + Duo upstream verzia" />
  <img class="diagram-dark" src="/images/duo-versioning-dark.svg" alt="Schéma verziovania Docker image: verzia projektu + Duo upstream verzia" />
</div>

- **Major** bump — breaking changes (premenované env premenné, nový entrypoint)
- **Minor** bump — nové funkcie (nové env premenné, RadSec podpora)
- **Patch** bump — bugfixy, Duo version bump, aktualizácia base image

## Dokumentácia a podpora

Kompletná dokumentácia vrátane všetkých environment premenných, príkladov a pokročilej konfigurácie je v [README na GitHube](https://github.com/ict-solutions-dev/docker-duoauthproxy#readme). Ak narazíte na problém alebo máte otázku, neváhajte [vytvoriť issue](https://github.com/ict-solutions-dev/docker-duoauthproxy/issues) alebo ma [kontaktovať](/cv/) priamo.
