---
title: 'GitHub release process for small projects'
description: 'How I set up an automated release process with release-drafter, conventional commits and autolabeling. Simple, no overkill tooling.'
pubDate: 2026-03-07T18:00:00
tags: ['github', 'ci-cd', 'devops', 'building-in-public']
---

When you have a personal site or a small open-source project, the release process is usually the last thing on your mind. Commit, push, done. But when you look back later, you have no idea what was in v0.1 vs v0.3.

Here's how I solved it for this site — simply, without unnecessary tooling.

## What I wanted

1. **Automatic changelog** — grouped by change type (features, fixes, maintenance)
2. **Draft release** — ready to publish anytime
3. **PR autolabeling** — no manual tagging
4. **Minimal maintenance** — no CHANGELOG.md, no release branches

## Conventional commits as the foundation

Everything is built on [conventional commits](https://www.conventionalcommits.org/). Every commit and PR title has a prefix:

```
feat: add RSS feed support
fix: correct nav active state on EN locale
chore: update release drafter config
refactor: extract isActive helper
docs: add deployment guide
```

This isn't just a convention — it's machine-readable information that powers the entire release flow.

## Release Drafter

[Release Drafter](https://github.com/release-drafter/release-drafter) is a GitHub Action that:

1. Tracks merged PRs into `main`
2. Automatically adds labels based on PR title (autolabeler)
3. Maintains a draft release with a categorized changelog
4. Suggests the next version (minor for feat, patch for fix)

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

The `push` trigger to `main` updates the draft release. The `pull_request_target` trigger runs the autolabeler.

### Configuration

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

The autolabeler matches PR titles via regex. `feat(blog): add new post` → label `feat`. `fix: correct nav state` → label `fix`. No manual clicking.

## GitHub labels

I deleted all default GitHub labels (`bug`, `enhancement`, `wontfix`...) and replaced them with a set that maps 1:1 to conventional commits:

| Label | Color | Description |
|-------|-------|-------------|
| `feat` | green | New feature |
| `fix` | red | Bug fix |
| `chore` | yellow | Maintenance |
| `refactor` | blue | Code refactor |
| `docs` | light blue | Documentation |
| `test` | gray | Tests |
| `breaking` | dark red | Breaking change |

One label = one change type. No duplicates, no confusion.

## The result

After merging a PR into `main`, the draft release updates automatically:

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

When I want a release, I go to GitHub → Releases → click **Publish** on the draft. Done.

## Why not semantic-release or changesets?

For a personal site/blog, those are overkill:

- **semantic-release** — auto-publishes on every merge. I don't want a release for every blog post.
- **changesets** — requires manual changeset files on every PR. Overkill for a single-maintainer project.
- **CHANGELOG.md** — another file to maintain. GitHub Releases serve the same purpose.

Release Drafter is the sweet spot: automated, but with a manual publish trigger.

## Versioning

I use [semver](https://semver.org/) with a simple approach:

- `v0.x.0` — for milestones during development
- `v1.0.0` — when the site is "done" and publicly promoted
- Tags only when closing a logical chunk of work, not on every PR

## Step by step setup

1. Adopt conventional commits in your workflow
2. Create labels: `gh label create feat --color 0E8A16`
3. Add `.github/release-drafter.yml` config
4. Add `.github/workflows/release.yml` workflow
5. Delete unnecessary default labels
6. Merge your first PR and check the draft release

The entire setup takes 10 minutes and then runs on its own.
