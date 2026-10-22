# Beyond™ Gateway

**Free your world.** A beautiful home network for every family: one router, one simple app, and the way back always one cable away.

Beyond Gateway is the router side of the Beyond tools, alongside [Beyond™ TV](https://github.com/YeahBuddyNZ/Beyond.TV) and Beyond Family. It is [OpenWrt](https://openwrt.org) underneath, the open router system that runs on thousands of routers, with the Beyond app on top in place of OpenWrt's own screens.

## What it does today (stage 1)

- **Finds the internet by itself.** Plug it into the fibre box on the wall and it works out how your ISP hands out the internet: DHCP on VLAN 10 (One NZ, Spark, 2degrees and most New Zealand fibre), plain DHCP behind another router, or PPPoE. Nobody types a VLAN.
- **Three-step setup from a phone.** Join the "Beyond Setup" Wi-Fi, open `beyond.lan`, pick a Wi-Fi name and password (use your old ones and every device rejoins by itself), and a router password.
- **Your home at a glance.** Internet, the router and your devices, live speed, how long the internet has been up, and anything that joined today.
- **Devices.** Everything on the network with its name, what it is, Wi-Fi or cable and signal. Rename it, and pause its internet with one switch (it can still reach the router).
- **Wi-Fi.** One name across every band, changed in one place.
- **The way back.** Plug the cable back into your old router. OpenWrt's own screens are still there under *Advanced settings* for people who know networks.

Coming next: guest Wi-Fi with a QR code, devices under each person in Beyond Family (bedtime pause), Beyond Shield (AdGuard Home), a second router as a mesh point, and alerts on Beyond TV. The plan is in [docs/plan.md](docs/plan.md).

## Routers

| Router | Why | Install |
|---|---|---|
| **GL.iNet Flint 2 (GL-MT6000)** | The reference router: Wi-Fi 6, 2.5 Gb ports, plenty of room | From GL.iNet's own *Upgrade* page |
| OpenWrt One | Made by the OpenWrt project | From its recovery mode |
| GL.iNet Beryl AX (GL-MT3000) | Small and cheap, for flats and baches | From GL.iNet's own *Upgrade* page |

Your ISP's router isn't on the list on purpose: ISP routers have locked firmware the ISP can overwrite at any time. In New Zealand you don't need it: on fibre the box on the wall (the ONT) is separate, and Beyond Gateway plugs straight into it.

**A home phone through the modem?** One NZ, Spark and 2degrees only run voice calling through their own modem. Keep it plugged into one of Beyond's LAN ports just for the phone, or move the phone to the ISP's calling app.

## Installing (GL.iNet Flint 2)

1. Download `...beyond...glinet_gl-mt6000-squashfs-sysupgrade.bin` from the latest build.
2. Plug a laptop into the Flint 2 and open `192.168.8.1` (GL.iNet's own page).
3. *System* → *Upgrade* → *Local Upgrade*, choose the file, **untick Keep Settings**, and install. It restarts as Beyond Gateway (about 3 minutes). Not yet tried on a real Flint 2: the first one is the test.
4. Plug the cable from the fibre box into the **WAN** port. Join the **Beyond Setup** Wi-Fi on your phone, open **beyond.lan**, and follow the three steps.

If anything goes wrong, GL.iNet routers have a recovery page that can't be overwritten: hold the reset button while plugging in the power, then open `192.168.1.1` and upload GL.iNet's own firmware.

## Building

```bash
./build.sh                  # GL.iNet Flint 2
./build.sh openwrt_one      # or another router from the table
```

Linux x86_64 with make, curl, zstd and Node.js 20 or newer. It builds the app, downloads OpenWrt's Image Builder (checked against OpenWrt's checksums), adds the packages in `packages.txt` and everything in `files/` and the built app, and leaves the images in `out/<router>/`. CI builds all three on every push.

## Trying the app without a router

```bash
cd web && npm install && npm run dev
# then open http://localhost:5173/?preview   (or ?preview=setup for first-run setup)
```

The preview runs against a made-up house (`web/src/mock.js`). The router's build (`npm run build:router`) leaves it out altogether.

## How it fits together

- `files/` goes onto the router as it is: first-boot settings (`etc/uci-defaults/90-beyond`), the internet finder (`usr/libexec/beyond/wan-detect`), pausing devices (`usr/libexec/beyond/apply-pause`) and the `beyond` ubus object the app talks to (`usr/share/rpcd/ucode/beyond.uc`, with who may call what in `usr/share/rpcd/acl.d/beyond.json`).
- `web/` is the app: React, Vite and Tailwind, with its parts from ReUI (shadcn's `base-nova` style on Base UI), built into the image and served by the router at `/beyond/`.
- `tests/` runs with `sh tests/run.sh`.

## Licence

GPL-3.0 (see `LICENSE`), like Beyond TV. OpenWrt is GPL-2.0 and LuCI Apache-2.0; their source is at openwrt.org and this repo is how our images are made. Sora is under the SIL Open Font Licence (`web/public/LICENSE-Sora-OFL.txt`). "Like UniFi" means the feel only: no Ubiquiti code or names.
