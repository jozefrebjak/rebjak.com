---
title: 'Všetky VPN pod jednou ikonou v menu bare na macOS'
description: 'AnyConnect aj FortiGate pod jednou ikonou v menu bare cez SwiftBar. A prečo openfortivpn nemá dostať root cez jedno sudoers pravidlo.'
pubDate: 2026-11-03T12:00:00
tags: ['macos', 'vpn', 'swiftbar', 'anyconnect', 'fortinet', 'security', 'zsh']
draft: false
lang: sk
---

Denne sa pripájam na tri VPN: Cisco AnyConnect s overením cez Duo push, AnyConnect s overením cez SMS a FortiGate, kde sa prihlasujem cez SSO v prehliadači. Tri aplikácie, tri okná, tri postupy. Keď som chcel vedieť, ktorá je práve pripojená, musel som otvoriť všetky.

Chcel som **jednu ikonu v menu bare, jeden klik na pripojenie a hneď vidieť, na čo sa čaká.** Najviac som sa však naučil o tom, ako dať VPN klientovi root bez toho, aby som si otvoril zadné dvierka.

Kód je verejný na GitHube ako šablóna, do ktorej doplníš vlastné VPN. Tu je hlavne to, prečo je postavený práve takto.

## Z čoho sa to skladá

- **[SwiftBar](https://github.com/swiftbar/SwiftBar)** urobí z ľubovoľného skriptu položku v menu bare. Čo skript vypíše, to je menu.
- **Cisco Secure Client** má popri GUI aj CLI, ktoré ovláda `expect`.
- **[openfortivpn](https://github.com/adrienverge/openfortivpn)** namiesto FortiClientu, ktorý na macOS nemá CLI.
- **Keychain** na heslá. Skript si heslo vytiahne až vo chvíli, keď sa naň VPN klient spýta, takže v skriptoch ani v configu žiadne nie je.

<a href="/images/blog/swiftbar-vpn-menu.webp" data-lightbox>
  <img src="/images/blog/swiftbar-vpn-menu.webp" alt="SwiftBar menu so všetkými VPN, pripojené k Work cez AnyConnect s Duo" width="952" height="968" loading="lazy" style="display: block; width: 100%; max-width: 476px; margin: 0 auto; border-radius: 12px; cursor: zoom-in;" />
</a>

Počas pripájania menu ukazuje, na čo sa čaká, napríklad „Approve the Duo push on your phone“ s tlačidlom **Cancel**. Keď spojenie spadne, notifikácia ponúkne **Reconnect**.

2FA však nechávam na sebe. Duo push schvaľujem na telefóne a SMS kód zadám do dialógu, ktorý vyskočí počas pripájania. Skript by ho vedel prečítať aj zo Správ, ale SwiftBar by potreboval Full Disk Access a obchádzal by presne to, na čo 2FA je: aby som prihlásenie potvrdil ja.

## AnyConnect cez CLI

Pripojenie je jeden príkaz a pár odpovedí na výzvy. Najviac času ma stálo toto:

- **Kým beží GUI, CLI sa nepripojí**, ani keď je okno skryté. Aplikáciu treba naozaj ukončiť.
- **Odpovede nejde poslať naraz cez pipe.** Niektoré VPN servery potom zlyhajú na overení certifikátu.
- **Skupinu treba vyberať číslom, nie názvom.** S názvom server prihlásenie odmietne a nepovie prečo.
- **Heslo nesmie prísť príliš skoro**, inak ho klient zahodí. Stačí počkať pol sekundy.
- **Nikdy nezapínať debug v `expect`.** Zapíše do logu aj heslo v čistom texte.

## Root bez zadných dvierok

openfortivpn potrebuje root a SwiftBar sa na heslo pre `sudo` spýtať nevie. Prvé, čo asi každému napadne, je jedno pravidlo v sudoers:

```text
jdoe ALL=(root) NOPASSWD: /opt/homebrew/bin/openfortivpn
```

Vyzerá nevinne, ale je to root shell pre čokoľvek, čo beží pod mojím účtom. Homebrew patrí používateľovi, takže binárku, jej knižnice aj config môže hocičo bez hesla podvrhnúť a pri ďalšom pripojení sa spustia ako root.

Namiesto toho je tu malý root helper, ktorý sa nainštaluje raz cez `sudo`:

- skopíruje openfortivpn aj s knižnicami na miesto, ktoré patrí rootovi,
- prijme len pár presne určených príkazov a pripojí sa len na servery zo zoznamu,
- sudoers pravidlo povoľuje presne tieto príkazy a nič iné.

Trade-off je, že po `brew upgrade` treba inštalátor spustiť znova. To je však zámer: nič, čo zmením ako bežný používateľ, sa k rootovi nedostane bez môjho `sudo`.

A ak si to chceš overiť: `sudo -n -l` nie je spoľahlivý test, či príkaz prejde bez hesla. Administrátorovi odpovie áno aj vtedy, keď heslo vyžaduje. Spoľahlivý test je `sudo -k; sudo -n <príkaz>`.

## Keď nefunguje DNS

Spravujem aj DNS recursory a ich update často robím práve cez VPN. Na zariadenia chodím cez IP adresy, ale VPN sa pripája na hostname. Keby sa pri update niečo pokazilo, nechcem ostať odrezaný práve vtedy, keď to potrebujem opraviť.

Helper preto drží adresy VPN serverov v `/etc/hosts`. Pred každým pripojením ich overí v DNS, a keď DNS neodpovedá, použije poslednú známu adresu. Hostname ostáva rovnaký, takže overenie certifikátu funguje ďalej.

## Kde začať

VPN popíšeš v `vpn.conf`, jeden riadok na každú. Kompletný postup aj s Keychain a root helperom je v README, skrátene:

```bash
git clone https://github.com/jozefrebjak/swiftbar-vpn.git ~/swiftbar-vpn
~/swiftbar-vpn/install.sh
$EDITOR ~/swiftbar-vpn/vpn.conf
```

```text
# id        type         label  host                  group      user  2fa
work        anyconnect   Work   vpn.example.com       Employees  jdoe  duo
uni         anyconnect   Uni    ra.example.edu        External   jdoe  sms
work-forti  forticlient  Work   fw.example.com:10443  -          -     duo
```

Zatiaľ sú tam AnyConnect a FortiClient, ktoré používam denne. OpenVPN a WireGuard pribudnú v dohľadnej dobe.

<a class="repo-card" href="https://github.com/jozefrebjak/swiftbar-vpn" target="_blank" rel="noopener">
  <span class="repo-card__mark" aria-hidden="true">
    <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
  </span>
  <span class="repo-card__body">
    <span class="repo-card__name">jozefrebjak/swiftbar-vpn</span>
    <p class="repo-card__desc">Všetky VPN pod jednou ikonou v menu bare: AnyConnect a FortiClient, Duo aj SMS, zabezpečený root helper pre openfortivpn a DNS fallback v /etc/hosts.</p>
    <span class="repo-card__meta">
      <span class="repo-card__tag">MIT</span>
      <span class="repo-card__tag">zsh / expect</span>
      <span class="repo-card__tag">SwiftBar plugin</span>
    </span>
  </span>
  <span class="repo-card__cta">Pozri na GitHube →</span>
</a>

---

Pozeral som sa aj na Tunnelblick či Viscosity, ale tie riešia hlavne OpenVPN a WireGuard, nie AnyConnect s Duo a FortiGate so SSO. Ak riešiš VPN na Macu inak alebo poznáš rozumnejší spôsob, ako dať VPN klientovi v menu bare root, ozvi sa mi na [LinkedIn](https://www.linkedin.com/in/jozefrebjak/) alebo [GitHube](https://github.com/jozefrebjak).
