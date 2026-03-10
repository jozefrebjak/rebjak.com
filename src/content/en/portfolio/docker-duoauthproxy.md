---
title: docker-duoauthproxy
description: Containerized Duo Authentication Proxy with multi-arch builds, Trivy scanning and SBOM attestation.
category: docker
tags: ["Docker", "GitHub Actions", "Security", "CI/CD"]
url: https://github.com/ict-solutions-dev/docker-duoauthproxy/pkgs/container/duoauthproxy
source: https://github.com/ict-solutions-dev/docker-duoauthproxy
order: 1
---

## What it solves

Duo Authentication Proxy is a service by Duo Security (Cisco) that acts as an intermediary between your local authentication infrastructure (Active Directory, RADIUS) and the Duo cloud service. It enables adding two-factor authentication (2FA) to existing VPN, SSH or web applications — without modifying the application itself.

However, the official Duo Authentication Proxy has no container distribution. Installation requires building from source, manual INI file configuration, and managing the service on the host system. This Docker image simplifies everything down to a single `docker run` command.

The image was designed for **Docker Swarm mode** — full Docker Secrets support, health checks and the ability to scale replicas without configuration changes.

## Authentication flow

Typical deployment in a network with FortiGate, FreeRADIUS and MariaDB:

<div class="diagram-zoom">
  <img class="diagram-light" src="/images/duo-auth-flow-light.svg" alt="Duo Authentication Proxy flow diagram" />
  <img class="diagram-dark" src="/images/duo-auth-flow-dark.svg" alt="Duo Authentication Proxy flow diagram" />
</div>

1. Client connects to **FortiGate** VPN with username and password
2. FortiGate sends a RADIUS request to **Duo Auth Proxy**
3. Duo Auth Proxy verifies the password against **FreeRADIUS** (which authenticates via **MariaDB**)
4. After successful password verification, requests 2FA via **Duo Cloud** (push notification, SMS, OTP)
5. After 2FA approval, returns RADIUS Accept back to FortiGate

## Quick start

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

The entire configuration is done through **environment variables** — no manual editing of config files. The entrypoint script at startup:

1. Reads variables (including `_FILE` variants for Docker secrets)
2. Validates inputs — checks required variables, sequential host ordering, allowed values
3. Generates `authproxy.cfg` from variables
4. Tests connectivity to Duo API
5. Starts the proxy daemon

## Configuration via environment variables

Instead of a classic INI file, the entire configuration is ENV-first:

| Variable | Description |
| --- | --- |
| `RADIUS_HOST` | RADIUS server hostname or IP |
| `RADIUS_SECRET` | RADIUS server shared secret |
| `DUO_IKEY` | Duo integration key |
| `DUO_SKEY` | Duo secret key |
| `DUO_API_HOST` | Duo API hostname |
| `RADIUS_CLIENT_IP_1` | First RADIUS client IP address |
| `RADIUS_CLIENT_SECRET_1` | First RADIUS client shared secret |

Supports up to **6 RADIUS servers** and **6 clients** via numbered variables (`RADIUS_HOST_2`, `RADIUS_CLIENT_IP_3`, ...).

Optional variables like `RADIUS_FAILMODE` (safe/secure), `RADIUS_PASS_THROUGH_ATTRS` or `RADIUS_CLIENT_TYPE` (radius_client, ad_client, duo_only_client) enable advanced configuration without touching config files.

## Security

Security was a priority from the first commit:

- **Non-root container** — runs as user `duo` (UID/GID 35505), not root
- **Docker Secrets support** — every sensitive variable supports the `_FILE` suffix. Instead of `-e RADIUS_SECRET=password`, use `-e RADIUS_SECRET_FILE=/run/secrets/radius_secret` and the secret is read from a file. If both variants are set, the container refuses to start
- **Log redaction** — the entrypoint script masks all sensitive values in startup logs
- **Trivy vulnerability scanning** — every build is scanned for known vulnerabilities, results uploaded to GitHub Security tab
- **SBOM generation** — each build produces a Software Bill of Materials in SPDX format via Anchore
- **Build provenance attestation** — GitHub Attestations verify the image was actually built in the CI pipeline

```yaml
# Docker Compose with Docker Secrets
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

The GitHub Actions workflow runs on push to `develop`, tag creation (`v*`), and manual dispatch. Pipeline:

1. **Lint** — Dockerfile checked via hadolint
2. **Build** — multi-arch image (`linux/amd64` + `linux/arm64`) via Docker Buildx
3. **Push** — published to GitHub Container Registry
4. **Scan** — Trivy scans for vulnerabilities
5. **SBOM** — generated in SPDX format
6. **Attestation** — build provenance via GitHub Attestations

## Versioning

The image tag contains both versions — the project and the upstream Duo:

<div class="diagram-zoom">
  <img class="diagram-light" src="/images/duo-versioning-light.svg" alt="Docker image versioning scheme: project version + Duo upstream version" />
  <img class="diagram-dark" src="/images/duo-versioning-dark.svg" alt="Docker image versioning scheme: project version + Duo upstream version" />
</div>

- **Major** bump — breaking changes (renamed env vars, new entrypoint)
- **Minor** bump — new features (new env vars, RadSec support)
- **Patch** bump — bugfixes, Duo version bump, base image update

## Documentation and support

Complete documentation including all environment variables, examples and advanced configuration is available in the [README on GitHub](https://github.com/ict-solutions-dev/docker-duoauthproxy#readme). If you run into an issue or have a question, feel free to [open an issue](https://github.com/ict-solutions-dev/docker-duoauthproxy/issues) or [contact me](/en/cv/) directly.
