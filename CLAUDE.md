# Beyond Gateway: notes for Claude

Beyond's router: OpenWrt underneath, the Beyond app on top. Part of the Beyond tools with Beyond TV
(YeahBuddyNZ/Beyond.TV) and Beyond Family (YeahBuddyNZ/Beyond-Family). Tagline "Free your world".

## Ours

- **Writing:** New Zealand English everywhere (copy, comments, commits). No em dashes. Dates DD/MM/YYYY. Brand is "Beyond™".
- **Brand:** Beyond's own purple, as on gobeyond.nz (Kyle, 22/10/2026, "purple like our colours"): violet `#6E3DDB`
  (the one thing to press), violet text `#6135D6`, lilac `#9E7BFF`, void `#0D0C18` to `#2C2458` on the home map. Paper
  `#F7F6F2` and ink `#22221F` for reading, ember `#E8A33D` for earned things only, and the four dots as the mark.
  Sora for display type. Tokens live once, on `:root` in `web/app.css`.
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
- `web/` is plain modern JavaScript modules, no build step. Pure decisions go in `web/lib.js`, tested with `node --test`.
  `?preview` runs the app against `web/mock.js` (made-up names only, never real family names).
- Checks: `sh tests/run.sh`; `./build.sh --stage-only` without network; CI builds the images.
- The ucode has not been run here (no ucode in the sandbox, and downloads.openwrt.org is blocked from it): the first
  real router is its first run. Say so when reporting.
