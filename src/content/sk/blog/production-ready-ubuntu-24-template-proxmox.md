---
title: 'Production-ready Ubuntu 24.04 šablóna v Proxmoxe'
description: 'Ako vytvoriť VM šablónu v Proxmoxe s Ubuntu 24.04 cloud image, cloud-init snippetom a automatickým LVM dátovým diskom. Klon pripravený do produkcie za minúty.'
pubDate: 2026-03-06
tags: ['proxmox', 'ubuntu', 'cloud-init', 'lvm', 'production']
lang: sk
---

# Ako si vytvoriť production-ready Ubuntu 24.04 šablónu v Proxmoxe

Manuálne inštalovať Ubuntu na každú novú VM je strata času. V tomto článku si ukážeme, ako vytvoriť VM šablónu v Proxmoxe s Ubuntu 24.04 cloud image, cloud-init snippetom a automatickým LVM dátovým diskom — tak, aby bol každý klon pripravený do produkcie behom niekoľkých minút.

## Čo dostaneš

- **Ubuntu 24.04 LTS** z oficiálneho cloud image (minimálny, bez GUI)
- **Root disk (15G)** — jednoduchý partition, celý pre OS
- **Dátový disk (50G)** — LVM s oddelenými `/home`, `/var`, `/opt`, `/var/lib`
- **Automatizácia** — cloud-init pri prvom boote nainštaluje balíky, nastaví LVM a rebootne
- **Predkonfigurovaný SSH prístup** — žiadne heslo, len SSH kľúč
- **QEMU guest agent** — Proxmox vidí IP adresu, vie robiť graceful shutdown

Celý proces trvá cca 15 minút. Každý ďalší klon je hotový za 3–5 minút (vrátane automatického LVM setupu).

## Prečo cloud image a nie ISO?

Ubuntu cloud image je špeciálny minimálny obraz (~700 MB) pripravený pre virtualizáciu:

- **Cloud-init ready** — konfigurácia siete, používateľa a balíkov bez manuálneho zásahu
- **Minimálny** — žiadne zbytočné balíky, menší attack surface
- **Rýchly deploy** — import do Proxmoxu trvá sekundy, nie desiatky minút ako klasická inštalácia

## Prečo dva disky?

Klasický prístup je jeden veľký disk s LVM. Cloud image to ale nepoužíva — root je na jednoduchej partícii. Namiesto boja s prerozdeľovaním root disku použijeme druhý disk:

| Disk | Veľkosť | Účel |
|------|---------|------|
| `scsi0` | 15G | OS root `/` — celý disk, jednoduchý partition |
| `scsi1` | 50G | LVM `data-vg` — `/home`, `/var`, `/opt`, `/var/lib` |

Výhody:
- **Root disk zostáva čistý** — žiadne komplikácie s cloud image layoutom
- **Dátový disk sa dá ľahko zväčšiť** — `qm disk resize` + `pvresize` + `lvextend`
- **Voľné miesto v data-vg** — rozšíriš, kde potrebuješ

## Prečo rozdeľujem partície?

Oddelenie `/home`, `/var`, `/opt` a `/var/lib` na samostatné LV nie je len zvyk zo starých čias — má praktický zmysel aj dnes:

- **`/var` (logy, cache, spool)** — logy vedia zaplniť disk za hodiny. Keď je `/var` na vlastnom LV, plný disk nepoloží celý systém. Stále sa vieš prihlásiť a vyčistiť.
- **`/var/lib` (databázy, kontajnery, aplikačné dáta)** — Docker images, PostgreSQL dáta, apt cache. Často najväčší konzument miesta. Na vlastnom LV ho vieš rozšíriť nezávisle.
- **`/home` (používateľské dáta)** — izolované od systému. Používateľ nezaplní root disk.
- **`/opt` (third-party aplikácie)** — monitoring agenti, vlastné aplikácie. Oddelené od OS.

### Best practices z produkcie

1. **Izolácia zlyhania** — Ak jedna partícia zaplní disk, ostatné fungujú ďalej. SSH prístup zostáva funkčný aj keď `/var/log` exploduje.
2. **Granulárne rozšírenie** — Nemusíš zväčšovať celý disk. Pridáš miesto len tam, kde je potrebné (`lvextend -L +10G /dev/data-vg/var`).
3. **Rôzne mount options** — Možnosť nastaviť `noexec` na `/var`, `nosuid` na `/home` pre lepšiu bezpečnosť.
4. **Jednoduchší backup a monitoring** — `df -h` okamžite ukáže, čo zaberá miesto. Alerting na 90% zaplnenie konkrétnej partície.
5. **Jednoduchšia migrácia** — LV sa dá snapshotovať, presúvať, zálohovať nezávisle.

<div class="callout tip">

Veľkosti LV v šablóne sú zámerne malé (5G, 4G). Voľné miesto zostáva v `data-vg` a rozšíriš ho podľa reálnej potreby konkrétneho klonu. Databázový server dostane viac na `/var/lib`, webový server na `/opt`.

</div>

## Predpoklady

- Proxmox VE 8.x alebo 9.x
- Storage pool pre VM disky (Ceph RBD, LVM-thin, ZFS, ...)
- Shared storage s podporou snippets (CephFS, NFS, ...) — alebo lokálny storage ak máš jeden node
- SSH prístup na Proxmox node ako root

### Placeholdery použité v článku

V príkazoch nižšie nahraď podľa svojho prostredia:

| Placeholder | Popis | Príklad |
|-------------|-------|---------|
| `<STORAGE_POOL>` | Storage pool pre VM disky | `local-lvm`, `ceph-pool`, `zfs-pool` |
| `cephfs_data` | Storage pre snippets a images | `local`, `nfs-share`, `cephfs` |
| `<BRIDGE>` | Linux bridge pre VM sieť | `vmbr0`, `vmbr1` |
| `<VLAN_ID>` | VLAN tag (ak používaš) | `100`, `3021` |
| `<USERNAME>` | Predvolený používateľ v šablóne | `admin`, `deploy` |
| `<GITHUB_USER>` | GitHub username pre SSH kľúče | `octocat` |
| `<IP>/<CIDR>` | IP adresa s maskou | `10.0.0.50/24` |
| `<GATEWAY>` | Default gateway | `10.0.0.1` |

## Krok 1: Stiahni cloud image

Cloud image potrebuješ uložiť na storage, kde je dostupný pre snippets a ISO images. Ak máš Ceph klaster, ideálne na CephFS — bude dostupný zo všetkých nodov a nemusíš ho kopírovať. Ak nemáš shared storage, použi lokálny storage (`/var/lib/vz/`), ale image a snippet budeš musieť manuálne skopírovať na každý node, z ktorého chceš klonovať.

```bash
mkdir -p /mnt/pve/cephfs_data/template/iso

wget -P /mnt/pve/cephfs_data/template/iso/ \
  https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
```

## Krok 2: Priprav cloud-init snippet

Toto je srdce celej šablóny. Snippet sa spustí pri prvom boote každého klonu a postará sa o:

1. Aktualizáciu systému a inštaláciu balíkov
2. Vytvorenie LVM na dátovom disku
3. Presun dát z root disku na nové LV
4. Konfiguráciu fstab a reboot

```bash
mkdir -p /mnt/pve/cephfs_data/snippets

# Povoľ snippets na CephFS storage (ak ešte nie je)
pvesm set cephfs_data --content backup,iso,vztmpl,snippets
```

Vytvor snippet. Okrem LVM setupu obsahuje aj zoznam balíkov, ktoré sa nainštalujú pri prvom boote — nemusíš ich inštalovať manuálne na každom klone:

- **qemu-guest-agent** — Proxmox cez neho vidí IP adresu VM a vie spraviť graceful shutdown
- **nano, vim** — editory, vždy sa hodia
- **wget, curl, jq, unzip** — sťahovanie a spracovanie dát
- **htop, lsof, tree** — monitoring a diagnostika
- **net-tools, dnsutils, traceroute, tcpdump** — sieťová diagnostika (`ifconfig`, `dig`, `traceroute`, `tcpdump`)
- **git, zsh** — version control a shell
- **ufw, fail2ban** — základný firewall a ochrana pred brute-force
- **apt-transport-https, software-properties-common** — podpora HTTPS repozitárov a `add-apt-repository`
- **bash-completion, man-db** — kvalita života v termináli

Zoznam si uprav podľa potreby — pridaj, čo používaš, odober, čo nepotrebuješ.

```bash
cat > /mnt/pve/cephfs_data/snippets/data-vg-setup.yml << 'EOF'
#cloud-config
package_update: true
package_upgrade: true
packages:
  - qemu-guest-agent
  - nano
  - vim
  - wget
  - htop
  - net-tools
  - dnsutils
  - traceroute
  - tcpdump
  - lsof
  - tree
  - unzip
  - jq
  - zsh
  - git
  - apt-transport-https
  - software-properties-common
  - bash-completion
  - man-db
  - ufw
  - fail2ban
runcmd:
  - systemctl enable --now qemu-guest-agent
  - |
    for i in $(seq 1 30); do [ -b /dev/sdb ] && break; sleep 1; done
    if [ -b /dev/sdb1 ]; then exit 0; fi
    parted -s /dev/sdb mklabel gpt
    parted -s /dev/sdb mkpart primary 0% 100%
    parted -s /dev/sdb set 1 lvm on
    sleep 2
    pvcreate /dev/sdb1
    vgcreate data-vg /dev/sdb1
    lvcreate -L 5G -n home data-vg
    lvcreate -L 5G -n var  data-vg
    lvcreate -L 4G -n opt  data-vg
    lvcreate -L 5G -n lib  data-vg
    mkfs.ext4 -q /dev/data-vg/home
    mkfs.ext4 -q /dev/data-vg/var
    mkfs.ext4 -q /dev/data-vg/opt
    mkfs.ext4 -q /dev/data-vg/lib
    mkdir -p /mnt/newlv
    mount /dev/data-vg/home /mnt/newlv
    rsync -a /home/ /mnt/newlv/
    umount -l /mnt/newlv
    mount /dev/data-vg/opt /mnt/newlv
    rsync -a /opt/ /mnt/newlv/
    umount -l /mnt/newlv
    mount /dev/data-vg/lib /mnt/newlv
    rsync -a /var/lib/ /mnt/newlv/
    umount -l /mnt/newlv
    mount /dev/data-vg/var /mnt/newlv
    rsync -a /var/ --exclude='lib' /mnt/newlv/
    umount -l /mnt/newlv
    rmdir /mnt/newlv
    echo "/dev/data-vg/var     /var       ext4  defaults,discard  0 2" >> /etc/fstab
    echo "/dev/data-vg/home    /home      ext4  defaults,discard  0 2" >> /etc/fstab
    echo "/dev/data-vg/opt     /opt       ext4  defaults,discard  0 2" >> /etc/fstab
    echo "/dev/data-vg/lib     /var/lib   ext4  defaults,discard  0 2" >> /etc/fstab
    reboot
EOF
```

### Prečo ten rsync a reboot?

Cloud-init beží ešte na root disku. Snippet musí:
1. Vytvoriť LVM a naformátovať LV
2. Skopírovať existujúce dáta z root na nové LV (napr. `/var` už obsahuje systémové súbory)
3. Pridať mount pointy do fstab
4. Rebootnúť — až po reboote sa LV namontujú na správne cesty

Poradie kopírovania je dôležité — `/var/lib` sa kopíruje **pred** `/var`, pretože rsync `/var` s `--exclude='lib'` preskočí `lib/` (to už je na vlastnom LV).

## Krok 3: Vytvor VM

```bash
qm create 9001 --name ubuntu-24-cloudinit \
  --memory 2048 \
  --cores 2 \
  --cpu host \
  --net0 virtio,bridge=vmbr0 \
  --scsihw virtio-scsi-single \
  --agent enabled=1 \
  --ostype l26
```

<div class="callout note">

`bridge=vmbr0` nahraď podľa svojej topológie. Typicky `vmbr0` je management sieť a ďalšie bridge (vmbr1, vmbr2, ...) sú pre dátové/produkčné VLANy.

</div>

Prečo `virtio-scsi-single`? S Ceph/RBD je to najlepší SCSI controller — každý disk dostane vlastný iothread, čo zlepšuje IOPS.

## Krok 4: Import a nastavenie diskov

```bash
# Import cloud image do Ceph RBD poolu
qm importdisk 9001 /mnt/pve/cephfs_data/template/iso/noble-server-cloudimg-amd64.img <STORAGE_POOL>

# Pripoj importovaný disk
qm set 9001 --scsi0 <STORAGE_POOL>:vm-9001-disk-0,discard=on,iothread=1,ssd=1

# Zväčši root disk na 15G (cloud image má len ~3.5G)
qm disk resize 9001 scsi0 15G

# Pridaj dátový disk 50G
qm set 9001 --scsi1 <STORAGE_POOL>:50,discard=on,iothread=1,ssd=1
```

## Krok 5: Cloud-init a boot

```bash
# Cloud-init disk
qm set 9001 --ide2 <STORAGE_POOL>:cloudinit

# Pripoj snippet
qm set 9001 --cicustom "vendor=cephfs_data:snippets/data-vg-setup.yml"

# Boot z root disku + sériová konzola
qm set 9001 --boot order=scsi0
qm set 9001 --serial0 socket --vga serial0
```

## Krok 6: Predvolené nastavenia

### Používateľ a SSH kľúč

SSH kľúč môžeš získať z GitHubu (každý používateľ má verejné kľúče na `github.com/<USER>.keys`), alebo použiť lokálny kľúč z Proxmox nodu:

```bash
# Variant A: SSH kľúč z GitHubu
curl -s https://github.com/<GITHUB_USER>.keys > /tmp/user_keys

# Variant B: Lokálny SSH kľúč
cp ~/.ssh/id_rsa.pub /tmp/user_keys
# Alebo manuálne vytvorený súbor s verejným kľúčom
# echo "ssh-rsa AAAA..." > /tmp/user_keys

qm set 9001 --ciuser <USERNAME>
qm set 9001 --sshkeys /tmp/user_keys
```

<div class="callout note">

Súbor s kľúčmi môže obsahovať viac kľúčov (každý na novom riadku). Heslo sa nenastavuje — prístup je len cez SSH kľúč. Ak napriek tomu potrebuješ heslo: `qm set 9001 --cipassword <HESLO>`

</div>

### Sieť a DNS

```bash
# DHCP (prepíšeš pri klonovaní)
qm set 9001 --ipconfig0 ip=dhcp

# DNS (prepíšeš pri klonovaní na interné)
qm set 9001 --nameserver "9.9.9.9 149.112.112.112"
```

## Krok 7: Testovací boot

Pred konverziou na šablónu musíš overiť, že všetko funguje. Ak nemáš DHCP v sieti (bežné v produkcii), nastav dočasnú statickú IP:

```bash
# Statická IP pre testovací boot (bez DHCP)
qm set 9001 --ipconfig0 ip=<IP>/<CIDR>,gw=<GATEWAY>
qm set 9001 --net0 virtio,bridge=<BRIDGE>,tag=<VLAN_ID>

qm start 9001
```

Sleduj boot cez sériovú konzolu:

```bash
qm terminal 9001
# Ukončíš cez Ctrl+O
```

Prvý boot trvá 3–5 minút (aktualizácia, balíky, LVM setup, reboot).

### Overenie

```bash
ssh <USERNAME>@<IP>

# Na VM
lsblk
df -h
sudo vgs
sudo lvs
```

Očakávaná štruktúra:

```
NAME               SIZE  MOUNTPOINTS
sda                 15G
├─sda1              14G  /
├─sda14              4M
├─sda15            106M  /boot/efi
└─sda16            913M  /boot
sdb                 50G
└─sdb1              50G
  ├─data--vg-home    5G  /home
  ├─data--vg-var     5G  /var
  ├─data--vg-opt     4G  /opt
  └─data--vg-lib     5G  /var/lib
```

## Krok 8: Vyčistenie a konverzia na šablónu

Na VM pred vypnutím:

```bash
sudo cloud-init clean --logs
sudo truncate -s 0 /etc/machine-id
sudo rm -f /var/lib/dbus/machine-id
sudo rm -f /etc/ssh/ssh_host_*
sudo rm -f /root/.bash_history /home/*/.bash_history
history -c
sudo poweroff
```

Na Proxmox node:

```bash
# Vráť sieť na DHCP
qm set 9001 --ipconfig0 ip=dhcp
qm set 9001 --net0 virtio,bridge=vmbr0

# Konvertuj na šablónu
qm template 9001

# Pridaj popis viditeľný v Proxmox UI
qm set 9001 --description "Ubuntu 24.04 LTS (Noble) cloud-init template

Root disk (scsi0): 15G - simple partition, no LVM
Data disk (scsi1): 50G - LVM (data-vg)
  - home 5G, var 5G, opt 4G, lib 5G, free space

Vendor snippet: cephfs_data:snippets/data-vg-setup.yml
First boot: system update, packages, LVM setup, reboot

Clone: qm clone 9001 <ID> --name <NAME> --full
Set IP: qm set <ID> --ipconfig0 ip=x.x.x.x/xx,gw=x.x.x.x
Set DNS: qm set <ID> --nameserver '1.2.3.4' --searchdomain 'example.com'
Set VLAN: qm set <ID> --net0 virtio,bridge=<BRIDGE>,tag=XXXX

Default user: <USERNAME> (SSH key from GitHub)
Default DNS: Quad9 (9.9.9.9, 149.112.112.112)
Default network: DHCP"
```

## Ako klonovať

```bash
# Vytvor klon
qm clone 9001 <NEW_ID> --name <HOSTNAME> --full

# Nastav podľa potreby
qm set <NEW_ID> --memory 8192 --cores 4
qm set <NEW_ID> --ipconfig0 ip=<IP>/<CIDR>,gw=<GATEWAY>
qm set <NEW_ID> --nameserver "<DNS1> <DNS2>" --searchdomain "<DOMAIN>"
qm set <NEW_ID> --net0 virtio,bridge=<BRIDGE>,tag=<VLAN_ID>

# Štart
qm start <NEW_ID>
```

Pri prvom boote cloud-init automaticky nastaví sieť, vytvorí používateľa, nainštaluje balíky, vytvorí LVM a rebootne. Po 3–5 minútach je VM pripravená.

### Zväčšenie dátového disku

```bash
# Na Proxmox node
qm disk resize <NEW_ID> scsi1 150G

# Na VM
sudo pvresize /dev/sdb1
sudo lvextend -l +100%FREE /dev/data-vg/<LV_NAME>
sudo resize2fs /dev/data-vg/<LV_NAME>
```

### Pridanie swap (voliteľné)

```bash
sudo lvcreate -L 4G -n swap data-vg
sudo mkswap /dev/data-vg/swap
sudo swapon /dev/data-vg/swap
echo "/dev/data-vg/swap none swap sw 0 0" | sudo tee -a /etc/fstab
```

## Gotchas a tipy

- **SeaBIOS, nie UEFI** — Ubuntu cloud images nie sú kompatibilné s OVMF pri importe cez `qm importdisk`. SeaBIOS funguje spoľahlivo.
- **SSH host key changed** — Po zničení a vytvorení novej VM na rovnakej IP spusti `ssh-keygen -R <IP>`.
- **Snippet sa dá zmeniť** — Snippet na CephFS sa dá editovať kedykoľvek. Zmena sa prejaví pri ďalšom klonovaní, existujúce klony to neovplyvní.
- **Šablóna sa nedá editovať** — Ak chceš zmeniť image, vytvor novú šablónu s novým ID a starú zmaž (`qm destroy 9001 --purge`).
- **Guest agent** — Cloud image ho neobsahuje, preto je v snippete v sekcii `packages`. Bez neho Proxmox nevidí IP adresu VM.
- **umount -l** — Snippet používa lazy unmount, pretože niektoré procesy môžu mať otvorené súbory v `/var` počas cloud-init behu.

---

Ak máš nápad, ako niečo z tohto spraviť lepšie, alebo ti niečo nefunguje — ozvi sa mi na [LinkedIn](https://www.linkedin.com/in/jozefrebjak/) alebo [GitHube](https://github.com/jozefrebjak). Rád sa poučím aj od teba.
