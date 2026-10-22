# Beyond Gateway: notes for Claude

Beyond's router: OpenWrt underneath, the Beyond app on top. Part of the Beyond tools with Beyond TV
(YeahBuddyNZ/Beyond.TV) and Beyond Family (YeahBuddyNZ/Beyond-Family). Tagline "Free your world".

## Ours

- **Writing:** New Zealand English everywhere (copy, comments, commits). No em dashes. Dates DD/MM/YYYY. Brand is "Beyond™".
- **Brand:** Beyond's own purple, as on gobeyond.nz (Kyle, 22/10/2026, "purple like our colours"): violet `#6E3DDB`
  (the one thing to press), violet text `#6135D6`, lilac `#9E7BFF`, void `#0D0C18` to `#2C2458` on the home map. Paper
  `#F7F6F2` and ink `#22221F` for reading, ember `#E8A33D` for earned things only, and the four dots as the mark.
  Sora for display type. Tokens live once, on `:root` in `web/src/index.css`.
- **People aren't technical.** Plain words on every screen ("Fibre (VLAN 10)", "Paused"), one primary button per screen,
  and say what will happen before it happens.
- **Never flash or modify an ISP's router.** Beyond Gateway replaces it at the fibre box (ONT), or sits behind it.
- **The way back always works:** plugging the old router back in, and LuCI under Advanced settings.
- **Never commit keys, passwords or a person's network details.**

## The code

- `files/` is the router's filesystem overlay (Image Builder `FILES=`). `files/etc/rc.d/S99beyond` is a symlink that
  enables the init script, because Image Builder only enables init scripts that come from packages.
- `beyond.uc` is the only API the app uses (rpcd ucode plugin, ubus object `beyond`). A method the app calls must be in
  `beyond.uc` and in `acl.d/beyond.json`; `tests/api.test.mjs` checks. Before setup only `setup_state` and
  `finish_setup` are open, and `finish_setup` refuses once setup is done.
- Pausing is an nftables set written by `apply-pause` into `/etc/nftables.d/20-beyond.nft`, which fw4 includes.
- `wan-detect` tries without changing anything (udhcpc with `-s /bin/true`, a throwaway VLAN device) and writes UCI only
  once something answers. Order: already online, VLAN 10 DHCP, untagged DHCP, VLAN 10 PPPoE, PPPoE.
- `web/` is React 19, Vite and Tailwind v4 with ReUI (Kyle, 22/10/2026: "Use REUI as much as possible"): style
  `base-nova` on Base UI, `components.json` as in Beyond Family. Every visible part comes from `components/ui` or
  `components/reui` (installed output: compose, never edit); new ones via `npx shadcn@latest add @reui/<name>`, or
  copied from Beyond Family when reui.io is blocked. Card-led screens, state through ReUI Badge and Alert variants.
  The home map is a Card with the `dark` class: colours are `@theme inline`, so `.dark` switches everything inside it.
- Only `web/src/api.ts` talks to the router (a test checks). Pure decisions stay in `web/src/lib.js`, plain JavaScript
  so `node --test` runs it with no build. `?preview` runs against `web/src/mock.js` (made-up names only, never real
  family names); `npm run build:router` (what `build.sh` runs) leaves it out.
- Checks: `sh tests/run.sh`; `cd web && npm run build` (typecheck and build); `./build.sh --stage-only` without network; CI builds the images.
- The ucode has not been run here (no ucode in the sandbox, and downloads.openwrt.org is blocked from it): the first
  real router is its first run. Say so when reporting.

## Mesh

- One **main** router and up to 10 **points** (`beyond.mesh.role`: '' on its own, `main`, `point`). Any make running
  Beyond Gateway. A point joins from Setup (`join_mesh`, open before setup like `finish_setup` and refusing after it):
  `files/usr/libexec/beyond/mesh join` bridges its WAN port into the LAN, takes an address from the main router, checks
  it really is a set-up Beyond router, signs in to it with the password the person typed (which becomes the point's
  too) and calls `mesh_join` for its own secret. Anything going wrong puts the network back as it was.
- Each minute `mesh sync` posts to the main router's `/cgi-bin/beyond-mesh` (LAN only, 403 without the secret), which
  hands it to `mesh_sync`; the answer (Wi-Fi name, password, country, the point's name) goes to `mesh_apply`, which
  changes the radios only when something differs. Live point state is in `/tmp/beyond-mesh`, never the flash.
- `mesh_sync`, `mesh_report` and `mesh_apply` are internal, never in the ACL (`tests/api.test.mjs`). Roaming is
  802.11k/v plus usteer (full `wpad-mbedtls`); 802.11r stays off because some older devices drop off with it.
- By cable only for now. Over the air (802.11s) is the next step, where the radios allow.

## Updates and help

- **Updates** (`files/usr/libexec/beyond/update`, `tests/update.test.sh`): nightly cron from `91-beyond-updates`, installs
  only a `latest.txt` signed with the `GATEWAY_UPDATE_KEY` secret (usign format, `tools/update-key.mjs`), only a newer
  `build=`, only the router's own file by its signed checksum, after `sysupgrade -T`, keeping settings. Manual by
  default; `beyond.updates.auto` is the overnight switch. CI's release job publishes every main build as the latest
  release with fixed file names (`beyond-gateway-<router>-sysupgrade.*`) that gobeyond.nz/gateway links straight to.
  Never print, commit or ask for the key: Kyle pastes it into GitHub himself.
- `90-beyond` runs again after every sysupgrade and must skip once setup is done, or an update would put the Wi-Fi
  back to "Beyond Setup".
- **Help** is `web/src/help.ts` (`#help/<id>`, `HelpLink` on screens). The README's Help section and gobeyond.nz/gateway
  carry the same answers: change one, change all three.
