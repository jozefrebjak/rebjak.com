---
title: 'Why host CPU type on Proxmox is slower for Windows VMs'
description: 'The host CPU type enables Spectre/Meltdown mitigations inside Windows, dramatically slowing down RAM operations. The fix is x86-64-v3.'
pubDate: 2026-03-04T18:00:00
tags: ['proxmox', 'windows', 'virtualization', 'performance', 'homelab']
draft: false
lang: en
---

Environment: Proxmox VE, Intel Xeon E5-2650 v3, Ceph cluster, Windows Server 2019 RDS.

## Symptoms

A production RDS server with 10–13 users was running slow. Grafana monitoring showed nothing dramatic — average CPU 15.8%, RAM 37.2% of 20 GiB. Initial optimization addressed disk (C: was 91.8% full) and RAM ballooning. After those changes, I looked at the VM configuration itself.

The CPU type was set to `host` — a standard choice recommended by many guides. It turned out that was exactly the problem.

## Root cause: Spectre/Meltdown mitigations in Windows

When you set the CPU type to `host`, QEMU passes all CPU flags from the physical processor into the VM, including security-related ones:

- `md_clear` — instruction to clear microarchitectural data (MDS mitigation)
- `flush_l1d` — flush the L1 data cache (L1TF mitigation)

These flags exist because of the Spectre and Meltdown vulnerabilities from 2018. Windows sees them and responds: *"this CPU is vulnerable, I need to activate OS-level protection."* It enables its own mitigations — performing extra steps on every memory access.

```
1. Windows detects md_clear and flush_l1d flags
2. Activates MDS, FBClear, L1TF, SBDR/FBSDP/PSDP mitigations
3. RAM latency: ~100 ns → ~2000 ns (20× slowdown)
```

The result is a dramatic slowdown of memory operations and overall performance — especially on older CPUs like Haswell/Broadwell.

## Verification

To check the mitigation status, use the `SpeculationControl` PowerShell module:

```powershell
Install-Module -Name SpeculationControl -Force
Get-SpeculationControlSettings
```

| Mitigation | `host` | `x86-64-v3` |
|---|---|---|
| MDS | True ✗ | False ✓ |
| FBClear | True ✗ | False ✓ |
| L1TF | True ✗ | False ✓ |
| SBDR/FBSDP/PSDP | True ✗ | False ✓ |

With `host` CPU type — all mitigations active. With `x86-64-v3` — none.

## Fix: x86-64-v3

`x86-64-v3` is a standardized CPU profile. It includes performance extensions (AVX, AVX2, AES, SSE4.2, FMA) but **does not include** the security flags `md_clear` and `flush_l1d`. Windows therefore sees no reason to activate Spectre/Meltdown mitigations.

Security is maintained — mitigations run at the Proxmox kernel (hypervisor) level, not inside each VM separately.

```bash
qm set <VMID> -cpu x86-64-v3
```

Requires a full shutdown + start — a reboot from within Windows is not enough.

## Bonus: Live migration

The `host` CPU type has another problem — live migration can fail if cluster nodes have different microcode versions (a single firmware update on one node is enough). With `x86-64-v3` the profile is fixed and independent of the physical CPU → migration between nodes is safe.
