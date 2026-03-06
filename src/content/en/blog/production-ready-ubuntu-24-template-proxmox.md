---
title: 'Production-ready Ubuntu 24.04 template in Proxmox'
description: 'How to create a VM template in Proxmox with Ubuntu 24.04 cloud image, cloud-init snippet and automatic LVM data disk. Production-ready clone in minutes.'
pubDate: 2026-03-06
tags: ['proxmox', 'ubuntu', 'cloud-init', 'lvm', 'production']
lang: en
---

# How to create a production-ready Ubuntu 24.04 template in Proxmox

Manually installing Ubuntu on every new VM is a waste of time. In this article we'll create a VM template in Proxmox with an Ubuntu 24.04 cloud image, a cloud-init snippet and an automatic LVM data disk — so that every clone is production-ready within minutes.

## What you get

- **Ubuntu 24.04 LTS** from the official cloud image (minimal, no GUI)
- **Root disk (15G)** — simple partition, entire disk for the OS
- **Data disk (50G)** — LVM with separate `/home`, `/var`, `/opt`, `/var/lib`
- **Automation** — cloud-init installs packages, sets up LVM and reboots on first boot
- **Pre-configured SSH access** — no password, SSH key only
- **QEMU guest agent** — Proxmox can see the IP address and perform graceful shutdowns

The entire process takes about 15 minutes. Each subsequent clone is ready in 3–5 minutes (including the automatic LVM setup).

## Why a cloud image and not an ISO?

An Ubuntu cloud image is a special minimal image (~700 MB) built for virtualization:

- **Cloud-init ready** — network, user and package configuration without manual intervention
- **Minimal** — no unnecessary packages, smaller attack surface
- **Fast deploy** — importing into Proxmox takes seconds, not tens of minutes like a traditional installation

## Why two disks?

The classic approach is a single large disk with LVM. Cloud images don't use that though — root sits on a simple partition. Instead of fighting with repartitioning the root disk, we use a second disk:

| Disk | Size | Purpose |
|------|------|---------|
| `scsi0` | 15G | OS root `/` — entire disk, simple partition |
| `scsi1` | 50G | LVM `data-vg` — `/home`, `/var`, `/opt`, `/var/lib` |

Benefits:
- **Root disk stays clean** — no complications with the cloud image layout
- **Data disk is easy to grow** — `qm disk resize` + `pvresize` + `lvextend`
- **Free space in data-vg** — extend wherever you need it

## Why separate partitions?

Separating `/home`, `/var`, `/opt` and `/var/lib` into individual LVs isn't just an old habit — it still makes practical sense today:

- **`/var` (logs, cache, spool)** — logs can fill a disk in hours. When `/var` is on its own LV, a full disk won't bring down the entire system. You can still log in and clean up.
- **`/var/lib` (databases, containers, application data)** — Docker images, PostgreSQL data, apt cache. Often the biggest space consumer. On its own LV you can extend it independently.
- **`/home` (user data)** — isolated from the system. A user can't fill the root disk.
- **`/opt` (third-party applications)** — monitoring agents, custom apps. Separated from the OS.

### Production best practices

1. **Failure isolation** — If one partition fills up, the rest keep working. SSH access remains functional even when `/var/log` explodes.
2. **Granular extension** — No need to grow the entire disk. Add space only where it's needed (`lvextend -L +10G /dev/data-vg/var`).
3. **Different mount options** — Option to set `noexec` on `/var`, `nosuid` on `/home` for better security.
4. **Easier backup and monitoring** — `df -h` immediately shows what's consuming space. Alerting on 90% usage of a specific partition.
5. **Easier migration** — LVs can be snapshotted, moved and backed up independently.

<div class="callout tip">

LV sizes in the template are intentionally small (5G, 4G). Free space remains in `data-vg` and you extend it based on the actual needs of each clone. A database server gets more on `/var/lib`, a web server on `/opt`.

</div>

## Prerequisites

- Proxmox VE 8.x or 9.x
- Storage pool for VM disks (Ceph RBD, LVM-thin, ZFS, ...)
- Shared storage with snippets support (CephFS, NFS, ...) — or local storage if you have a single node
- SSH access to the Proxmox node as root

### Placeholders used in this article

Replace the following in the commands below according to your environment:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `<STORAGE_POOL>` | Storage pool for VM disks | `local-lvm`, `ceph-pool`, `zfs-pool` |
| `cephfs_data` | Storage for snippets and images | `local`, `nfs-share`, `cephfs` |
| `<BRIDGE>` | Linux bridge for VM network | `vmbr0`, `vmbr1` |
| `<VLAN_ID>` | VLAN tag (if applicable) | `100`, `3021` |
| `<USERNAME>` | Default user in the template | `admin`, `deploy` |
| `<GITHUB_USER>` | GitHub username for SSH keys | `octocat` |
| `<IP>/<CIDR>` | IP address with mask | `10.0.0.50/24` |
| `<GATEWAY>` | Default gateway | `10.0.0.1` |

## Step 1: Download the cloud image

You need to store the cloud image on a storage accessible for snippets and ISO images. If you have a Ceph cluster, CephFS is ideal — it will be accessible from all nodes without copying. If you don't have shared storage, use local storage (`/var/lib/vz/`), but you'll need to manually copy the image and snippet to every node you want to clone from.

```bash
mkdir -p /mnt/pve/cephfs_data/template/iso

wget -P /mnt/pve/cephfs_data/template/iso/ \
  https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
```

## Step 2: Prepare the cloud-init snippet

This is the heart of the entire template. The snippet runs on every clone's first boot and takes care of:

1. System update and package installation
2. LVM creation on the data disk
3. Data migration from the root disk to the new LVs
4. fstab configuration and reboot

```bash
mkdir -p /mnt/pve/cephfs_data/snippets

# Enable snippets on CephFS storage (if not already)
pvesm set cephfs_data --content backup,iso,vztmpl,snippets
```

Create the snippet. Besides the LVM setup it also includes a list of packages installed on first boot — no need to install them manually on every clone:

- **qemu-guest-agent** — lets Proxmox see the VM's IP address and perform graceful shutdowns
- **nano, vim** — editors, always handy
- **wget, curl, jq, unzip** — downloading and processing data
- **htop, lsof, tree** — monitoring and diagnostics
- **net-tools, dnsutils, traceroute, tcpdump** — network diagnostics (`ifconfig`, `dig`, `traceroute`, `tcpdump`)
- **git, zsh** — version control and shell
- **ufw, fail2ban** — basic firewall and brute-force protection
- **apt-transport-https, software-properties-common** — HTTPS repository support and `add-apt-repository`
- **bash-completion, man-db** — quality of life in the terminal

Adjust the list to your needs — add what you use, remove what you don't.

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

### Why rsync and reboot?

Cloud-init runs while still on the root disk. The snippet must:
1. Create LVM and format the LVs
2. Copy existing data from root to the new LVs (e.g. `/var` already contains system files)
3. Add mount points to fstab
4. Reboot — only after the reboot are the LVs mounted at the correct paths

The copy order matters — `/var/lib` is copied **before** `/var`, because rsync on `/var` with `--exclude='lib'` skips `lib/` (it's already on its own LV).

## Step 3: Create the VM

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

Replace `bridge=vmbr0` according to your topology. Typically `vmbr0` is the management network and additional bridges (vmbr1, vmbr2, ...) are for data/production VLANs.

</div>

Why `virtio-scsi-single`? With Ceph/RBD it's the best SCSI controller — each disk gets its own iothread, improving IOPS.

## Step 4: Import and configure disks

```bash
# Import cloud image into the Ceph RBD pool
qm importdisk 9001 /mnt/pve/cephfs_data/template/iso/noble-server-cloudimg-amd64.img <STORAGE_POOL>

# Attach the imported disk
qm set 9001 --scsi0 <STORAGE_POOL>:vm-9001-disk-0,discard=on,iothread=1,ssd=1

# Resize root disk to 15G (cloud image is only ~3.5G)
qm disk resize 9001 scsi0 15G

# Add a 50G data disk
qm set 9001 --scsi1 <STORAGE_POOL>:50,discard=on,iothread=1,ssd=1
```

## Step 5: Cloud-init and boot

```bash
# Cloud-init disk
qm set 9001 --ide2 <STORAGE_POOL>:cloudinit

# Attach snippet
qm set 9001 --cicustom "vendor=cephfs_data:snippets/data-vg-setup.yml"

# Boot from root disk + serial console
qm set 9001 --boot order=scsi0
qm set 9001 --serial0 socket --vga serial0
```

## Step 6: Default settings

### User and SSH key

You can fetch the SSH key from GitHub (every user has public keys at `github.com/<USER>.keys`), or use a local key from the Proxmox node:

```bash
# Option A: SSH key from GitHub
curl -s https://github.com/<GITHUB_USER>.keys > /tmp/user_keys

# Option B: Local SSH key
cp ~/.ssh/id_rsa.pub /tmp/user_keys
# Or a manually created file with the public key
# echo "ssh-rsa AAAA..." > /tmp/user_keys

qm set 9001 --ciuser <USERNAME>
qm set 9001 --sshkeys /tmp/user_keys
```

<div class="callout note">

The key file can contain multiple keys (one per line). No password is set — access is SSH key only. If you still need a password: `qm set 9001 --cipassword <PASSWORD>`

</div>

### Network and DNS

```bash
# DHCP (override when cloning)
qm set 9001 --ipconfig0 ip=dhcp

# DNS (override when cloning for internal resolvers)
qm set 9001 --nameserver "9.9.9.9 149.112.112.112"
```

## Step 7: Test boot

Before converting to a template you must verify everything works. If you don't have DHCP on your network (common in production), set a temporary static IP:

```bash
# Static IP for test boot (no DHCP)
qm set 9001 --ipconfig0 ip=<IP>/<CIDR>,gw=<GATEWAY>
qm set 9001 --net0 virtio,bridge=<BRIDGE>,tag=<VLAN_ID>

qm start 9001
```

Monitor the boot via serial console:

```bash
qm terminal 9001
# Exit with Ctrl+O
```

The first boot takes 3–5 minutes (update, packages, LVM setup, reboot).

### Verification

```bash
ssh <USERNAME>@<IP>

# On the VM
lsblk
df -h
sudo vgs
sudo lvs
```

Expected layout:

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

## Step 8: Cleanup and convert to template

On the VM before shutdown:

```bash
sudo cloud-init clean --logs
sudo truncate -s 0 /etc/machine-id
sudo rm -f /var/lib/dbus/machine-id
sudo rm -f /etc/ssh/ssh_host_*
sudo rm -f /root/.bash_history /home/*/.bash_history
history -c
sudo poweroff
```

On the Proxmox node:

```bash
# Reset network to DHCP
qm set 9001 --ipconfig0 ip=dhcp
qm set 9001 --net0 virtio,bridge=vmbr0

# Convert to template
qm template 9001

# Add a description visible in the Proxmox UI
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

## How to clone

```bash
# Create a clone
qm clone 9001 <NEW_ID> --name <HOSTNAME> --full

# Configure as needed
qm set <NEW_ID> --memory 8192 --cores 4
qm set <NEW_ID> --ipconfig0 ip=<IP>/<CIDR>,gw=<GATEWAY>
qm set <NEW_ID> --nameserver "<DNS1> <DNS2>" --searchdomain "<DOMAIN>"
qm set <NEW_ID> --net0 virtio,bridge=<BRIDGE>,tag=<VLAN_ID>

# Start
qm start <NEW_ID>
```

On first boot cloud-init automatically configures the network, creates the user, installs packages, sets up LVM and reboots. After 3–5 minutes the VM is ready.

### Growing the data disk

```bash
# On the Proxmox node
qm disk resize <NEW_ID> scsi1 150G

# On the VM
sudo pvresize /dev/sdb1
sudo lvextend -l +100%FREE /dev/data-vg/<LV_NAME>
sudo resize2fs /dev/data-vg/<LV_NAME>
```

### Adding swap (optional)

```bash
sudo lvcreate -L 4G -n swap data-vg
sudo mkswap /dev/data-vg/swap
sudo swapon /dev/data-vg/swap
echo "/dev/data-vg/swap none swap sw 0 0" | sudo tee -a /etc/fstab
```

## Gotchas and tips

- **SeaBIOS, not UEFI** — Ubuntu cloud images are not compatible with OVMF when imported via `qm importdisk`. SeaBIOS works reliably.
- **SSH host key changed** — After destroying and creating a new VM on the same IP, run `ssh-keygen -R <IP>`.
- **Snippet can be modified** — The snippet on CephFS can be edited anytime. Changes take effect on the next clone; existing clones are not affected.
- **Template cannot be edited** — If you want to change the image, create a new template with a new ID and delete the old one (`qm destroy 9001 --purge`).
- **Guest agent** — The cloud image doesn't include it, which is why it's in the snippet's `packages` section. Without it Proxmox can't see the VM's IP address.
- **umount -l** — The snippet uses lazy unmount because some processes may have open files in `/var` during the cloud-init run.

---

If you have ideas on how to improve any of this, or something doesn't work for you — reach out on [LinkedIn](https://www.linkedin.com/in/jozefrebjak/) or [GitHub](https://github.com/jozefrebjak). Happy to learn from you too.
