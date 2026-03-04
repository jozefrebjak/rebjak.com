---
title: 'Why host CPU type on Proxmox is slower for Windows VMs'
description: 'The host CPU type enables Spectre/Meltdown mitigations inside Windows, dramatically slowing down RAM operations. The fix is x86-64-v3.'
pubDate: 2026-03-04T18:00:00
tags: ['proxmox', 'windows', 'virtualization', 'performance', 'homelab']
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

Results on q35 machine type:

| Mitigation | `host` | `x86-64-v3` |
|---|---|---|
| MDS | True ✗ | False ✓ |
| FBClear | True ✗ | False ✓ |
| L1TF | True ✗ | False ✓ |
| SBDR/FBSDP/PSDP | True ✗ | False ✓ |

With `host` CPU type — all mitigations active. With `x86-64-v3` — none.

## Benchmark results

Tested on a production RDS server — 8 vCPU, 16 GiB RAM, Ceph SSD storage, Intel Xeon E5-2650 v3.

### i440fx machine type

| Test | `host` | `x86-64-v3` | Difference |
|---|---|---|---|
| CPU — prime numbers | 13.65 s | 12.99 s | x86-64-v3 5% faster |
| RAM throughput | 1.9 GB/s | 1.8 GB/s | comparable |
| Disk write | 1054 MB/s | 1048 MB/s | comparable |
| Disk read | 1266 MB/s | 1300 MB/s | comparable |

On i440fx the difference is not significant — i440fx doesn't correctly pass all flags, so mitigations don't trigger even with `host`.

### q35 machine type

| Test | `x86-64-v3` | `host` |
|---|---|---|
| CPU — prime numbers | 14.56 s | — |
| RAM throughput | 1.58 GB/s | — |
| MDS mitigation | False ✓ | True ✗ |
| FBClear mitigation | False ✓ | True ✗ |
| L1TF mitigation | False ✓ | True ✗ |
| SBDR/FBSDP/PSDP | False ✓ | True ✗ |

On q35 the effect is fully visible — `host` enables all mitigations. Raw numbers on an idle server don't show a dramatic difference, but under production load with multiple RDS users, the increased memory latency compounds on every single operation.

## Fix: x86-64-v3

`x86-64-v3` is a standardized CPU profile. It includes performance extensions (AVX, AVX2, AES, SSE4.2, FMA) but **does not include** the security flags `md_clear` and `flush_l1d`. Windows therefore sees no reason to activate Spectre/Meltdown mitigations.

Security is maintained — mitigations run at the Proxmox kernel (hypervisor) level, not inside each VM separately.

```bash
qm set <VMID> -cpu x86-64-v3
```

Requires a full shutdown + start — a reboot from within Windows is not enough.

## Bonus: Live migration

The `host` CPU type has another problem — live migration can fail if cluster nodes have different microcode versions (a single firmware update on one node is enough). With `x86-64-v3` the profile is fixed and independent of the physical CPU → migration between nodes is safe.

## Note on machine types

On i440fx machine type the difference between `host` and `x86-64-v3` is not significant — i440fx maps both types similarly and not all flags are correctly passed through. The problem fully manifests on **q35**, which is the modern standard and recommended for new Windows VMs.

If migrating from i440fx to q35 causes you to lose the network adapter (controller change), VirtIO drivers and a single PowerShell command via the Proxmox console will restore your static IP.

## Recommended configuration

| Parameter | Value |
|---|---|
| CPU type | `x86-64-v3` |
| Machine type | `q35` |
| SCSI controller | `virtio-scsi-single` |
