---
title: 'PPPoE sessions z Cisco ASR1000 v LibreNMS: vlastný v2 plugin'
description: 'LibreNMS o PPPoE sessions na Cisco ASR1000 nevie nič. Postavil som v2 plugin nad CISCO-PPPOE-MIB: prehľad všetkých BRASov, rozpad PTA/FWDED/TRANS a zoznam subscriberov.'
pubDate: 2026-09-18T14:00:00
tags: ['librenms', 'cisco', 'pppoe', 'snmp', 'monitoring', 'php', 'isp']
draft: false
lang: sk
---

Cieľ bol jednoduchý: **vidieť všetkých päť BRASov a počet PPPoE sessions na jednom mieste.**

LibreNMS mi z ASR1000 dá CPU, pamäť, prevádzku na portoch, teploty. O sessions ani slovo. Pritom je to presne to číslo, ktoré ako admin potrebujem: koľko sessions visí na ktorom BRASe. Dovtedy to bolo SSH a `show pppoe summary` na piatich zariadeniach:

```
bras6#show pppoe summary
    PTA  : Locally terminated sessions
    FWDED: Forwarded sessions
    TRANS: All other sessions (in transient state)

                                TOTAL     PTA   FWDED   TRANS
TOTAL                             240     240       0       0
TenGigabitEthernet1/0/0            90      90       0       0
TenGigabitEthernet1/1/0           150     150       0       0
```

Fajn raz za čas, nie na trend a už vôbec nie na alert.

Nakoniec z toho bol vlastný v2 plugin pre LibreNMS. Takto to vyzerá dnes:

<figure style="margin: 2rem 0; text-align: center;">
  <a href="/images/blog/librenms-pppoe-overview.webp" data-lightbox>
    <img src="/images/blog/librenms-pppoe-overview.webp" alt="Prehľad všetkých BRASov s počtom PPPoE sessions v LibreNMS" style="width: 100%; border-radius: 12px; border: 1px solid #e4e4e7; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: zoom-in;" />
  </a>
  <figcaption style="text-align: center; margin-top: 0.5rem; font-size: 0.875rem; color: #71717a;">Všetky BRASy na jednej stránke: aktívne sessions, rozpad PTA/FWDED/TRANS a využitie voči limitu</figcaption>
</figure>

Ako som sa k tomu dostal a kde som po ceste narazil:

## Najprv Custom OID, lebo to je päť minút

LibreNMS má **Custom OID** priamo v editácii zariadenia: zadáš OID, dátový typ, jednotku, a poller ti to začne písať do RRD a grafovať. Ak ti stačí jedno číslo, nemusíš písať nič.

Pre celkový počet sessions to je:

| Pole | Hodnota |
|------|---------|
| OID | `.1.3.6.1.4.1.9.9.194.1.1.1.0` |
| Data Type | `GAUGE` |
| Unit | `sessions` |

To je `cPppoeSystemCurrSessions` z `CISCO-PPPOE-MIB`. Tá `.0` na konci je povinná, ide o skalár. Bez nej ti *Test OID* zlyhá.

Toto som spravil ako prvé a hneď to fungovalo. Mal som graf počtu sessions na BRAS. Lenže:

- **rozpad PTA / FWDED / TRANS** je v MIBe len per interface, čo by znamenalo jeden Custom OID na každý ifIndex, a tých mám na jednom ASR cez 4 000,
- **nevidím, kto je pripojený**, keď hľadám konkrétneho zákazníka, číslo mi nepomôže,
- a hlavne to **nie je prehľad**, musím preklikať päť zariadení, aby som vedel, ako na tom sieť je celkovo.

Takže Custom OID áno, na históriu je ideálny. Ale na "čo sa deje teraz" som potreboval niečo iné.

## Fáza nula: nehádať OIDs

Toto považujem za najdôležitejšiu časť a zároveň za tú, ktorú je najväčšie pokušenie preskočiť.

LibreNMS **nedodáva** ani `CISCO-PPPOE-MIB`, ani `CISCO-SUBSCRIBER-SESSION-MIB`, v `mibs/cisco/` ich jednoducho nemá. Takže som si ich stiahol z oficiálneho Cisco repozitára na GitHube a nechal si numerické OIDs vygenerovať:

```bash
curl -O https://raw.githubusercontent.com/cisco/cisco-mibs/main/v2/CISCO-PPPOE-MIB.my
snmptranslate -M +mibs -m CISCO-PPPOE-MIB -On CISCO-PPPOE-MIB::cPppoeSystemCurrSessions
# .1.3.6.1.4.1.9.9.194.1.1.1
```

A potom to isté overiť `snmpwalk`-om proti živému ASR. Až keď mi zariadenie odpovedalo, začal som písať kód.

Prečo takto: **plugin sa zariadenia pýta výhradne numerickými OIDmi.** Keby sa spoliehal na MIB súbory v runtime, musel by som ich distribuovať do kontajnera a riešiť `mibDir`. Takto sú MIB súbory v repozitári len referencia pre človeka, ktorý sa pýta „a čo to číslo vlastne znamená".

### Čo v tých MIBoch je

`CISCO-PPPOE-MIB` (`1.3.6.1.4.1.9.9.194`) dáva na úrovni celého zariadenia:

| OID | Objekt | Čo vracia |
|-----|--------|-----------|
| `...194.1.1.1.0` | `cPppoeSystemCurrSessions` | aktívne sessions |
| `...194.1.1.2.0` | `cPppoeSystemHighWaterSessions` | historické maximum |
| `...194.1.1.3.0` | `cPppoeSystemMaxAllowedSessions` | limit |
| `...194.1.1.5.0` | `cPppoeSystemExceededSessionErrors` | odmietnuté kvôli limitu |

A tabuľku `cPppoeSessionsPerInterfaceTable` indexovanú cez `ifIndex`, kde je pre každý interface **total, PTA, FWDED, TRANS** a prahy pre trapy.

Tie tri skratky stoja za vysvetlenie, lebo v MIBe sú bez kontextu:

- **PTA**: PPP Termination Aggregation, session sa terminuje na tomto BRASe a prevádzka ide lokálne do IP
- **FWDED**: session sa tu neterminuje, posiela sa ďalej, typicky L2TP tunelom na LNS
- **TRANS**: transient, session sa ešte dojednáva

`CISCO-SUBSCRIBER-SESSION-MIB` (`...786`) ide o úroveň nižšie: jeden riadok na subscribera, s username, stavom, IP adresou. Tam je háčik, ku ktorému sa dostanem.

## Prečo plugin a nie polling modul

Zvažoval som pridať polling modul priamo do LibreNMS core (`LibreNMS/OS/Iosxe.php`). Nakoniec plugin, z dvoch dôvodov: nechcem si udržiavať fork LibreNMS a pri každom upgrade riešiť konflikty, a rozpad per interface aj tak nemá kam ukladať bez vlastnej schémy.

LibreNMS v2 plugin je prekvapivo jednoduchá vec. Naklonuješ adresár do `app/Plugins/NazovPluginu/` a implementuješ hooky:

```
DeviceOverview.php      panel na stránke zariadenia
Menu.php                položka v menu
Page.php                samostatná stránka
Settings.php            konfigurácia
resources/views/*.blade.php
```

Štruktúra sa kontroluje pred inštaláciou a je case-sensitive. V každej hook triede prepisuješ len `data()` a `authorize()`, `handle()` je `final`.

Znie to priamočiaro a aj je. Len treba vedieť o štyroch veciach, ktoré v dokumentácii nie sú.

## Štyri pasce, ktoré ma stáli najviac času

### 1. `authorize()` nesmie typovať `App\Models\User`

Toto ma stálo najviac. Panel na device overview mi fungoval, ale stránka aj nastavenia hádzali **"Missing view"**. Žiadna chyba v logu, nič.

Hooky sa volajú cez `app()->call()`, takže argumenty sa resolvujú z Laravel containera. A `App\Models\User` tam **nie je nabindovaný**, v `AppServiceProvider` je z modelov nabindovaný len `Device`. Laravel teda poslušne vyrobí čerstvú prázdnu `User` inštanciu, `$user->can('global-read')` vráti `false`, hook sa odfiltruje a controller spadne na fallback view `plugins.missing`.

Panel fungoval jednoducho preto, že ako jediný `$user` vôbec nepoužíval.

Riešenie je typovať kontrakt, ktorý Laravel bindne na prihláseného používateľa:

```php
use Illuminate\Contracts\Auth\Authenticatable;

public function authorize(Authenticatable $user): bool
{
    return $user->can('global-read');
}
```

Mimochodom, presne takto to má `ExamplePlugin`, ktorý je súčasťou LibreNMS, hoci abstraktná trieda hooku deklaruje `User`. Keby som si ho pozrel skôr, ušetril by som si hodinu.

### 2. `SettingsHook` volá `data()` dvakrát

Toto je v zdrojáku vidno na prvý pohľad a aj tak sa na to dá naletieť:

```php
final public function handle(string $pluginName, array $settings, Application $app): array
{
    return array_merge([
        'content_view' => Str::start($this->view, "$pluginName::"),
    ], $this->data($app->call($this->data(...), [
        'settings' => $settings,
    ])));
}
```

Vnútorné volanie dostane skutočné nastavenia. Vonkajšie dostane **výsledok toho vnútorného** ako argument `$settings`. A vracia sa to vonkajšie.

Ak teda `data()` vracia `['settings' => $settings, ...]`, druhý priechod dostane zabalený array a v šablóne máš `$settings['settings']`. Riešim to rozbalením hneď na vstupe:

```php
public static function unwrap(array $settings): array
{
    if (isset($settings['settings']) && is_array($settings['settings'])) {
        return $settings['settings'];
    }

    return $settings;
}
```

Horšie je, keď má `data()` vedľajší efekt. Mám tam tlačidlo, ktoré zakladá Custom OIDy: prvý priechod ich založil, druhý ich už videl existovať a nahlásil "už existuje". Výsledok si preto pamätám na inštancii hooku.

### 3. `numeric()` a `hideMib()` sa navzájom vylučujú

V rôznych návodoch sa reťazí `SnmpQuery::device($device)->numeric()->hideMib()->walk($oid)`. Lenže obe metódy nastavujú **tú istú vlastnosť** `oidFormat`, a `hideMib()` je druhá v poradí, takže vyhrá:

```php
public function numeric(bool $numeric = true): SnmpQueryInterface
{
    $this->options->oidFormat = $numeric ? SnmpOidOutput::Numeric : SnmpOidOutput::Module;
    return $this;
}

public function hideMib(): SnmpQueryInterface
{
    $this->options->oidFormat = SnmpOidOutput::Suffix;
    return $this;
}
```

Namiesto numerických OIDov teda dostaneš holý suffix a parser si na tom vyláme zuby. Používam len `->numeric()`.

Bonus: v LibreNMS 26.8 je SNMP vrstva v `LibreNMS/Data/Source/NetSnmpQuery.php`, v aktuálnom masteri sa presunula do `Data/Source/Snmp/`. Preto v kóde používam globálny alias `SnmpQuery`, nie priamy namespace. Pri upgrade sa tak nič nerozbije.

### 4. net-snmp háda formát OCTET STRING a občas háda zle

Toto je najzákernejšie, lebo to vyzerá, že funguje.

IP adresa subscribera je `InetAddress`, teda `OCTET STRING` so štyrmi bajtmi. Bez načítanej MIB nemá net-snmp display hint, tak háda: ak sú bajty „tlačiteľné", vypíše ich ako text, inak ako hex. Takže `100.64.16.41` príde ako `64 40 10 29` (v pohode, rozparsujem), ale `100.64.13.53` ako `d@` a riadiaci znak, ktorý mi rozsypal celý výstup v termináli.

Pri ladení som to videl doslova takto, jeden riadok uprostred výpisu bol prepísaný sám sebou:

```
100030     user05@example.net     3      "64 40 08 C7 "
y"0032     user06@example.net     3      "d@
100035     user07@example.net     3      "64 40 0B 92 "
```

Riešenie je nehádať a vypýtať si hex explicitne. LibreNMS to dovolí cez `options()`:

```php
SnmpQuery::device($device)->options(['-OQXUtenx'])->walk($oid);
```

Tie flagy nie sú náhodné, je to presne to, čo LibreNMS posiela štandardne (`-OQXUte`), plus `n` pre numerické OIDs a `x` pre hex. Pozor na to, že `options()` v 26.8 ostatné voľby **nahradí**, nie doplní.

## Ešte zopár prekvapení od zariadenia

**`cPppoeSystemMaxAllowedSessions` nevracia nulu, keď nie je limit.** MIB tvrdí, že nenastavený limit je `0`. Moje ASR-ká vracajú `4294967295`, teda maximum `Unsigned32`. V UI to vyzeralo ako strop 4,3 miliardy sessions a všetky utilizačné ukazovatele mi vyšli na 0 %. Teraz beriem obe hodnoty ako „bez limitu".

**`csubSessionMacAddress` je prázdny.** Na IOS-XE 15.5(3)S nevracia nič, na každej session. Stĺpec som z pluginu vyhodil úplne, ušetrí to jeden celý walk cez tabuľku, ktorá má riadok na každého subscribera.

**Per-interface tabuľka pokrýva úplne všetko.** Na jednom BRASe vrátila vyše 4 000 riadkov, z ktorých sessions niesli dva. Zvyšok sú sub-interfacy s nulami. Default je teraz zobraziť len tie, čo niečo nesú, s prepínačom na zvyšok.

<figure style="margin: 2rem 0; text-align: center;">
  <a href="/images/blog/librenms-pppoe-detail.webp" data-lightbox>
    <img src="/images/blog/librenms-pppoe-detail.webp" alt="Detail BRASu: sessions po interfacoch a zoznam subscriberov" style="width: 100%; border-radius: 12px; border: 1px solid #e4e4e7; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: zoom-in;" />
  </a>
  <figcaption style="text-align: center; margin-top: 0.5rem; font-size: 0.875rem; color: #71717a;">Detail zariadenia. Všimni si „4292 idle interface(s) hidden": bez toho filtra by tabuľka mala 4 294 riadkov a dva užitočné</figcaption>
</figure>

## Zber dát: plugin nemá poller

Toto je principiálne obmedzenie, s ktorým sa treba zmieriť. V2 plugin systém má **len UI hooky**: `DeviceOverviewHook`, `MenuEntryHook`, `PageHook`, `PortTabHook`, `SettingsHook`. Žiadny z nich nebeží mimo HTTP requestu a lokálny plugin nevie zaregistrovať ani artisan command, ani scheduler. `PluginProvider` z neho načíta výhradne hook triedy.

Prakticky to znamená, že všetko sa deje počas renderovania stránky. Počty sessions sú lacné, jeden `snmpget` a jeden walk fyzických interfacov. Tie si pokojne vypýtam on-demand a nacachujem.

Zoznam subscriberov je iný príbeh: štyri walky, riadok na každého subscribera. Na BRASe s 2 200 sessions to je cez 8 000 varbindov a stránka by na to čakala. Riešenie:

- zoznam subscriberov sa pri renderovaní **nikdy** nesťahuje, číta sa výhradne z cache,
- keď tam nič nie je, stránka ponúkne tlačidlo **Poll the BRAS now**,
- kto chce mať dáta pripravené, pustí si priložený skript z cronu.

Ten skript si bootstrapne Laravel mimo requestu a naplní cache:

```php
require $installPath . '/vendor/autoload.php';
$app = require $installPath . '/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
```

Je to najbližšie k polleru, ako sa lokálny plugin dostane. Sám ho nepoužívam. Keď stránku otváram občas, cron by dopytoval ASR-ká pre nikoho.

## Grafy: nech to robí LibreNMS

Plugin si nič neukladá, takže sám o sebe nemá čo grafovať. Ale `poller_modules.customoid` je v LibreNMS zapnutý **defaultne**, čiže čokoľvek v tabuľke `customoids` poller sám zbiera do RRD, kreslí z toho grafy a dá sa na to alertovať.

Tak som sa vrátil na začiatok. V nastaveniach pluginu je tlačidlo, ktoré zaregistruje `cPppoeSystemCurrSessions` ako Custom OID na všetkých BRASoch, ktoré sedia na filter. Pred zápisom si hodnotu zo zariadenia sám prečíta, aby poller nezdedil OID, na ktoré zariadenie neodpovedá. Poller totiž berie len riadky s `customoid_passed = 1`.

Zámerne **len pridáva**. Nikdy nič neupraví ani nezmaže, aby sa nedala stratiť RRD história.

<figure style="margin: 2rem 0; text-align: center;">
  <a href="/images/blog/librenms-pppoe-settings.webp" data-lightbox>
    <img src="/images/blog/librenms-pppoe-settings.webp" alt="Nastavenia pluginu: filter zariadení, cache TTL a tlačidlo na založenie Custom OIDov" style="width: 100%; max-width: 620px; border-radius: 12px; border: 1px solid #e4e4e7; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: zoom-in;" />
  </a>
  <figcaption style="text-align: center; margin-top: 0.5rem; font-size: 0.875rem; color: #71717a;">Nastavenia: automatický filter na BRASy, cache TTL, voliteľný walk subscriberov a tlačidlo <em>Create custom OIDs</em></figcaption>
</figure>

Jedna drobnosť, na ktorej som sa pomýlil aj tu: odkaz na graf. LibreNMS parsuje z cesty ako parameter len tie segmenty, ktoré obsahujú `=` (`Url::parseLegacyPath`). Takže `device/633/graphs/customoid` nastaví záložku, ale skupinu grafov nie a skončíš na prvej v poradí. Správne je:

```
device/device=633/tab=graphs/group=customoid/
```

## Čo z toho je

Na jednej stránke vidím všetkých päť BRASov, súčet sessions, rozpad PTA/FWDED/TRANS a využitie voči limitu. Kliknutím sa prepadnem na konkrétne zariadenie, kde mám sessions po interfacoch, a ak chcem, aj zoznam subscriberov s username, stavom a pridelenou IP. Na stránke zariadenia mám ten istý prehľad v malom paneli a odkaz na graf.

<figure style="margin: 2rem 0; text-align: center;">
  <a href="/images/blog/librenms-pppoe-device-panel.webp" data-lightbox>
    <img src="/images/blog/librenms-pppoe-device-panel.webp" alt="Panel PPPoE Sessions na stránke zariadenia v LibreNMS" style="width: 100%; max-width: 520px; border-radius: 12px; border: 1px solid #e4e4e7; box-shadow: 0 4px 12px rgba(0,0,0,0.08); cursor: zoom-in;" />
  </a>
  <figcaption style="text-align: center; margin-top: 0.5rem; font-size: 0.875rem; color: #71717a;">Panel priamo na device overview, s odkazom na graf a na detail</figcaption>
</figure>

Odpoveď na „koľko sessions mám na ktorom BRASe" je teraz jeden pohľad namiesto piatich SSH relácií.

Testoval som ho proti LibreNMS 26.8.2 a Cisco ASR1000 s IOS-XE 15.5(3)S. Iné platformy môžu tie MIBy napĺňať inak, hlavne ten prázdny MAC a hodnotu limitu by som na inom hardvéri overil.

<a class="repo-card" href="https://github.com/jozefrebjak/librenms-plugin-cisco-pppoe" target="_blank" rel="noopener">
  <span class="repo-card__mark" aria-hidden="true">
    <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
  </span>
  <span class="repo-card__body">
    <span class="repo-card__name">jozefrebjak/librenms-plugin-cisco-pppoe</span>
    <p class="repo-card__desc">PPPoE sessions z Cisco BRASov priamo v LibreNMS: prehľad všetkých zariadení, rozpad PTA/FWDED/TRANS, sessions po interfacoch a zoznam subscriberov.</p>
    <span class="repo-card__meta">
      <span class="repo-card__tag">MIT</span>
      <span class="repo-card__tag">PHP / Blade</span>
      <span class="repo-card__tag">LibreNMS v2 plugin</span>
    </span>
  </span>
  <span class="repo-card__cta">Pozri na GitHube →</span>
</a>

---

Ak monitoruješ PPPoE alebo IPoE termináciu inak (cez RADIUS accounting, streaming telemetry, alebo niečím, čo mi uniklo), napíš mi na [LinkedIn](https://www.linkedin.com/in/jozefrebjak/) alebo [GitHub](https://github.com/jozefrebjak). SNMP je tu evidentne najmenej elegantná cesta, len zhodou okolností tá, ktorú už mám všade zapnutú.
