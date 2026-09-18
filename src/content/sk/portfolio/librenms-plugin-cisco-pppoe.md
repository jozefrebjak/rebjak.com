---
title: librenms-plugin-cisco-pppoe
description: LibreNMS v2 plugin, ktorý do monitoringu doplní PPPoE sessions z Cisco BRASov cez SNMP.
category: monitoring
tags: ["LibreNMS", "Cisco", "SNMP", "PHP", "ISP"]
source: https://github.com/jozefrebjak/librenms-plugin-cisco-pppoe
order: 1
---

## Čo to rieši

LibreNMS vie z Cisco ASR1000 vyčítať CPU, pamäť, prevádzku na portoch aj teploty, ale o PPPoE termináciách nepovie nič. Práve to je pritom číslo, ktoré potrebujem: koľko sessions visí na ktorom BRASe.

Plugin to číta priamo zo `CISCO-PPPOE-MIB` a `CISCO-SUBSCRIBER-SESSION-MIB` a zobrazí to na jednej stránke.

<div class="diagram-zoom">
  <img src="/images/blog/librenms-pppoe-overview.webp" alt="Prehľad všetkých BRASov s počtom PPPoE sessions v LibreNMS" />
</div>

## Čo plugin ukáže

- **prehľad všetkých BRASov** so súčtom sessions, rozpadom PTA / FWDED / TRANS a využitím voči limitu,
- **detail zariadenia** so sessions po interfacoch, s automaticky skrytými nulovými sub-interfacmi,
- **zoznam subscriberov** s username, stavom a pridelenou IP adresou,
- **panel priamo na stránke zariadenia** v LibreNMS, s odkazom na graf.

## Ako je to postavené

Je to natívny **LibreNMS v2 plugin**, teda žiadny fork a žiadne úpravy core. Inštaluje sa naklonovaním do `app/Plugins/` a zapnutím v UI.

Dopyty idú výhradne numerickými OIDmi, takže netreba do inštalácie distribuovať MIB súbory. Výsledky sa cachujú a zoznam subscriberov sa sťahuje len na vyžiadanie, aby BRAS nedostal walk cez tisíce riadkov pri každom načítaní stránky.

Históriu si plugin neukladá sám. Namiesto toho vie jedným tlačidlom zaregistrovať počet sessions ako **Custom OID** na všetkých BRASoch, takže grafy aj alerty rieši LibreNMS svojím vlastným pollerom.

## Testované na

LibreNMS 26.8.2, Cisco ASR1000 s IOS-XE 15.5(3)S. Licencia MIT.

Detailnejšie o tom, ako plugin vznikol a na čom som sa po ceste popálil, píšem v článku [PPPoE sessions z Cisco ASR1000 v LibreNMS](/blog/librenms-plugin-cisco-pppoe/).
