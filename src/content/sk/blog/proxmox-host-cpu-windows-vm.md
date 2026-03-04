---
title: 'Prečo je host CPU typ na Proxmox pomalší pre Windows VM'
description: 'CPU typ host aktivuje Spectre/Meltdown mitigácie vo Windows a dramaticky spomaľuje RAM operácie. Riešenie je x86-64-v3.'
pubDate: 2026-03-04T18:00:00
tags: ['proxmox', 'windows', 'virtualizácia', 'výkon', 'homelab']
lang: sk
---

Prostredie: Proxmox VE, Intel Xeon E5-2650 v3, Ceph cluster, Windows Server 2019 RDS.

## Symptómy

Produkčný RDS server s 10–13 používateľmi bol pomalý. Grafana monitoring neukazoval nič dramatické — priemerné CPU 15.8 %, RAM 37.2 % z 20 GiB. Prvotná optimalizácia riešila disk (C: bol 91.8 % plný) a RAM ballooning. Po týchto zmenách som sa pozrel na konfiguráciu samotného VM.

CPU typ bol nastavený na `host` — štandardná voľba, ktorú odporúča veľa návodov. Ukázalo sa, že práve toto je problém.

## Príčina: Spectre/Meltdown mitigácie vo Windows

Keď nastavíš CPU typ na `host`, QEMU prenesie do VM všetky CPU flagy fyzického procesora vrátane bezpečnostných:

- `md_clear` — inštrukcia na čistenie mikroarchitekturálnych dát (MDS mitigácia)
- `flush_l1d` — flushovanie L1 dátovej cache (L1TF mitigácia)

Tieto flagy existujú kvôli zraniteľnostiam Spectre a Meltdown z roku 2018. Windows ich vidí a reaguje: *"tento CPU je zraniteľný, musím aktivovať ochranu na úrovni OS."* Aktivuje vlastné mitigácie — pri každom prístupe do pamäte robí extra kroky.

```
1. Windows detekuje md_clear a flush_l1d flagy
2. Aktivuje MDS, FBClear, L1TF, SBDR/FBSDP/PSDP mitigácie
3. RAM latencia: ~100 ns → ~2000 ns (20× spomalenie)
```

Výsledok je dramatické spomalenie pamäťových operácií a celkového výkonu — hlavne na starších CPU ako Haswell/Broadwell.

## Overenie

Na zistenie stavu mitigácií slúži PowerShell modul `SpeculationControl`:

```powershell
Install-Module -Name SpeculationControl -Force
Get-SpeculationControlSettings
```

Výsledok na q35 machine type:

| Mitigácia | `host` | `x86-64-v3` |
|---|---|---|
| MDS | True ✗ | False ✓ |
| FBClear | True ✗ | False ✓ |
| L1TF | True ✗ | False ✓ |
| SBDR/FBSDP/PSDP | True ✗ | False ✓ |

S `host` CPU typom — všetky mitigácie aktívne. S `x86-64-v3` — žiadne.

## Namerané výsledky

Testované na produkčnom RDS serveri — 8 vCPU, 16 GiB RAM, Ceph SSD storage, Intel Xeon E5-2650 v3.

### i440fx machine typ

| Test | `host` | `x86-64-v3` | Rozdiel |
|---|---|---|---|
| CPU — prvočísla | 13.65 s | 12.99 s | x86-64-v3 o 5 % rýchlejší |
| RAM priepustnosť | 1.9 GB/s | 1.8 GB/s | porovnateľné |
| Disk zápis | 1054 MB/s | 1048 MB/s | porovnateľné |
| Disk čítanie | 1266 MB/s | 1300 MB/s | porovnateľné |

Na i440fx nie je rozdiel výrazný — i440fx neprenáša flagy správne, takže mitigácie sa nespúšťajú ani pri `host`.

### q35 machine typ

| Test | `x86-64-v3` | `host` |
|---|---|---|
| CPU — prvočísla | 14.56 s | — |
| RAM priepustnosť | 1.58 GB/s | — |
| MDS mitigácia | False ✓ | True ✗ |
| FBClear mitigácia | False ✓ | True ✗ |
| L1TF mitigácia | False ✓ | True ✗ |
| SBDR/FBSDP/PSDP | False ✓ | True ✗ |

Na q35 sa efekt plno prejaví — `host` aktivuje všetky mitigácie. Raw čísla na prázdnom serveri veľký rozdiel neodhalia, ale v produkcii pod záťažou viacerých RDS používateľov sa latencia pamäťových operácií prejaví na každej operácii.

## Riešenie: x86-64-v3

`x86-64-v3` je štandardizovaný CPU profil. Obsahuje výkonnostné rozšírenia (AVX, AVX2, AES, SSE4.2, FMA), ale **neobsahuje** bezpečnostné flagy `md_clear` a `flush_l1d`. Windows teda nevidí dôvod aktivovať Spectre/Meltdown mitigácie.

Bezpečnosť je zachovaná — mitigácie bežia na úrovni Proxmox kernelu (hypervisora), nie v každej VM zvlášť.

```bash
qm set <VMID> -cpu x86-64-v3
```

Vyžaduje shutdown + start VM — reboot zvnútra Windows nestačí.

## Bonus: Live migrácia

`host` CPU typ má ďalší problém — live migrácia môže zlyhať, ak majú nody v clustri rôzne verzie microcodu (stačí rozdielny firmware update na jednom node). S `x86-64-v3` je profil fixný a nezávislý od fyzického CPU → migrácia medzi nodmi je bezpečná.

## Poznámka k machine typom

Na i440fx machine type nie je rozdiel medzi `host` a `x86-64-v3` výrazný — i440fx mapuje oba typy podobne a nie všetky flagy sa správne prenášajú. Problém sa plno prejavuje na **q35**, ktorý je moderný štandard a odporúčaný pre nové Windows VM.

Ak migráciou z i440fx na q35 stratíš sieťový adaptér (zmena controllera), pomôžu VirtIO ovládače a jeden PowerShell príkaz cez Proxmox konzolu na obnovenie statickej IP.

## Odporúčaná konfigurácia

| Parameter | Hodnota |
|---|---|
| CPU typ | `x86-64-v3` |
| Machine typ | `q35` |
| SCSI controller | `virtio-scsi-single` |
