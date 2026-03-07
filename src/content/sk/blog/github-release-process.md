---
title: 'GitHub release proces pre malé projekty'
description: 'Ako som nastavil automatický release proces s release-drafter, conventional commits a autolabeling. Jednoducho, bez overkill toolingu.'
pubDate: 2026-03-07T18:00:00
tags: ['github', 'ci-cd', 'devops', 'building-in-public']
---

Keď máš osobný web alebo malý open-source projekt, release proces býva posledná vec, na ktorú myslíš. Commitneš, pushneš, hotovo. Ale keď sa potom pozrieš späť, nevieš čo bolo vo v0.1 a čo vo v0.3.

Ukážem, ako som to vyriešil pre tento web — jednoducho, bez zbytočného toolingu.

## Čo som chcel

1. **Automatický changelog** — zoskupený podľa typu zmeny (features, fixes, maintenance)
2. **Draft release** — pripravený na publish kedykoľvek
3. **Autolabeling PR** — žiadne manuálne taggovanie
4. **Minimum údržby** — žiadny CHANGELOG.md, žiadne release branches

## Conventional commits ako základ

Všetko stojí na [conventional commits](https://www.conventionalcommits.org/). Každý commit a PR title má prefix:

```
feat: add RSS feed support
fix: correct nav active state on EN locale
chore: update release drafter config
refactor: extract isActive helper
docs: add deployment guide
```

Toto nie je len konvencia — je to strojovo čitateľná informácia, na ktorej staviam celý release flow.

## Release Drafter

[Release Drafter](https://github.com/release-drafter/release-drafter) je GitHub Action, ktorý:

1. Sleduje mergnuté PR do `main`
2. Automaticky pridáva labely podľa PR title (autolabeler)
3. Udržiava draft release s kategorizovaným changelogom
4. Navrhuje ďalšiu verziu (minor pre feat, patch pre fix)

### Workflow

```yaml
name: Release Drafter

on:
  push:
    branches:
      - main
  pull_request_target:
    types:
      - opened
      - reopened
      - synchronize
      - labeled
      - unlabeled

permissions:
  contents: write
  pull-requests: write

jobs:
  update-release-draft:
    runs-on: ubuntu-latest
    steps:
      - uses: release-drafter/release-drafter@v6
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Trigger na `push` do `main` aktualizuje draft release. Trigger na `pull_request_target` spúšťa autolabeler.

### Konfigurácia

```yaml
# .github/release-drafter.yml
name-template: 'v$RESOLVED_VERSION'
tag-template: 'v$RESOLVED_VERSION'

categories:
  - title: '🚀 Features'
    labels:
      - 'feat'
  - title: '🐛 Bug Fixes'
    labels:
      - 'fix'
  - title: '🔧 Maintenance'
    labels:
      - 'chore'
      - 'refactor'
  - title: '📝 Documentation'
    labels:
      - 'docs'

autolabeler:
  - label: 'feat'
    title:
      - '/^feat(\(.+\))?[!]?:/'
  - label: 'fix'
    title:
      - '/^fix(\(.+\))?[!]?:/'
  - label: 'chore'
    title:
      - '/^chore(\(.+\))?[!]?:/'
  - label: 'refactor'
    title:
      - '/^refactor(\(.+\))?[!]?:/'
  - label: 'docs'
    title:
      - '/^docs(\(.+\))?[!]?:/'

version-resolver:
  major:
    labels:
      - 'breaking'
  minor:
    labels:
      - 'feat'
  patch:
    labels:
      - 'fix'
      - 'chore'
      - 'refactor'
      - 'docs'
  default: patch
```

Autolabeler matchuje PR title cez regex. `feat(blog): add new post` → label `feat`. `fix: correct nav state` → label `fix`. Žiadne manuálne klikanie.

## GitHub labels

Vymazal som všetky default GitHub labely (`bug`, `enhancement`, `wontfix`...) a nahradil ich sadou, ktorá mapuje 1:1 na conventional commits:

| Label | Farba | Popis |
|-------|-------|-------|
| `feat` | zelená | New feature |
| `fix` | červená | Bug fix |
| `chore` | žltá | Maintenance |
| `refactor` | modrá | Code refactor |
| `docs` | svetlomodrá | Documentation |
| `test` | sivá | Tests |
| `breaking` | tmavočervená | Breaking change |

Jeden label = jeden typ zmeny. Žiadne duplikáty, žiadna zmätočnosť.

## Výsledok

Po mergnutí PR do `main` sa automaticky aktualizuje draft release:

```markdown
## 🎉 What's Changed

## 🚀 Features
- feat: add release drafter workflow (#19) @jozefrebjak
- feat: add RSS feed links (#13) @jozefrebjak

## 🐛 Bug Fixes
- fix: correct active nav link detection (#17) @jozefrebjak
- fix: improve light mode readability (#15) @jozefrebjak

## 🔧 Maintenance
- chore: improve release drafter formatting (#21) @jozefrebjak
```

Keď chcem release, idem na GitHub → Releases → kliknem **Publish** na draft. Hotovo.

## Prečo nie semantic-release alebo changesets?

Pre osobný web/blog sú to kanóny na vrabca:

- **semantic-release** — automaticky publishuje pri každom merge. Nechcem release na každý blog post.
- **changesets** — vyžaduje manuálne changeset súbory pri každom PR. Overkill pre single-maintainer projekt.
- **CHANGELOG.md** — ďalší súbor na údržbu. GitHub Releases slúžia rovnako dobre.

Release Drafter je sweet spot: automatický, ale s manuálnym publish triggerom.

## Versioning

Používam [semver](https://semver.org/) s jednoduchým prístupom:

- `v0.x.0` — pre milníky počas vývoja
- `v1.0.0` — keď bude web "hotový" a verejne propagovaný
- Tag len keď uzatvorím logický celok, nie na každý PR

## Setup krok za krokom

1. Pridaj conventional commits do svojho workflow
2. Vytvor labely: `gh label create feat --color 0E8A16`
3. Pridaj `.github/release-drafter.yml` config
4. Pridaj `.github/workflows/release.yml` workflow
5. Vymaž nepotrebné default labely
6. Mergni prvý PR a skontroluj draft release

Celý setup zaberie 10 minút a potom beží sám.
