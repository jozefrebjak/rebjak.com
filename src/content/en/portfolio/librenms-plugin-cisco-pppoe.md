---
title: librenms-plugin-cisco-pppoe
description: A LibreNMS v2 plugin that brings PPPoE sessions from Cisco BRASes into your monitoring over SNMP.
category: monitoring
tags: ["LibreNMS", "Cisco", "SNMP", "PHP", "ISP"]
source: https://github.com/jozefrebjak/librenms-plugin-cisco-pppoe
order: 1
---

## What it solves

LibreNMS reads CPU, memory, port traffic and temperatures from Cisco ASR1000s, but it says nothing about PPPoE termination. That's the number I actually need: how many sessions sit on which BRAS.

The plugin reads it straight from `CISCO-PPPOE-MIB` and `CISCO-SUBSCRIBER-SESSION-MIB` and puts it on a single page.

<div class="diagram-zoom">
  <img src="/images/blog/librenms-pppoe-overview.webp" alt="All BRASes with their PPPoE session counts in LibreNMS" />
</div>

## What it shows

- an **overview of every BRAS** with total sessions, the PTA / FWDED / TRANS breakdown and utilisation against the limit,
- a **device detail** with sessions per interface, idle sub-interfaces hidden automatically,
- a **subscriber list** with username, state and assigned IP address,
- a **panel on the LibreNMS device page**, linking to the graph.

## How it's built

It's a native **LibreNMS v2 plugin**, so no fork and no core patches. You install it by cloning into `app/Plugins/` and enabling it in the UI.

All queries use numeric OIDs, so there are no MIB files to ship into the installation. Results are cached, and the subscriber list is only fetched on demand so the BRAS doesn't take a multi-thousand-row walk on every page load.

The plugin keeps no history of its own. Instead, one button registers the session count as a **Custom OID** on every matching BRAS, leaving graphing and alerting to the LibreNMS poller.

## Tested on

LibreNMS 26.8.2, Cisco ASR1000 running IOS-XE 15.5(3)S. MIT licensed.

For the full story of how it came about and what I got wrong on the way, see the post [PPPoE sessions from Cisco ASR1000 in LibreNMS](/en/blog/librenms-plugin-cisco-pppoe/).
