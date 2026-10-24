# Block Big Tech trackers

One switch in Beyond Gateway (*Settings*, **Block Big Tech trackers**) that stops the ads, tracking and telemetry of the
companies on Beyond's tech fines tracker ([gobeyond.nz/tech-fines](https://gobeyond.nz/tech-fines)) for every device in
the house, without breaking their products or Beyond's. **Off by default.** Added 25/10/2026 at Kyle's request: "block all
of the known tech companies involved in tech fines without breaking any of our products."

## The rule

Block what tracks people. Never block what makes a product work. So it is not "block Google": YouTube, Gmail, Maps, sign-in,
Google Play and Android all work. It is "block Google's ad and analytics addresses".

## The companies

From `lib/tech-fines.ts` in the website (30 fines, seven companies): Alphabet (Google), Apple, Meta (Facebook, Instagram,
WhatsApp), Amazon, Microsoft (and LinkedIn, Xbox), ByteDance (TikTok) and X.

## What's blocked (40 domains)

Each blocks itself and every name under it. The full list with a note on each line is
[`blocklists/big-tech-trackers/block.txt`](../blocklists/big-tech-trackers/block.txt).

| Company | Blocked | What it is |
|---|---|---|
| Alphabet | doubleclick.net, googleadservices.com, googlesyndication.com, googletagservices.com, adservice.google.com, adservice.google.co.nz | Google's ads on other sites and ad measurement |
| | google-analytics.com, region1.google-analytics.com, region1.analytics.google.com, googletagmanager.com | Google Analytics collection and the Tag Manager script that loads it |
| | app-measurement.com | Google Analytics for Firebase inside phone apps |
| Apple | iadsdk.apple.com, api-adservices.apple.com | In-app ads and App Store ad attribution |
| | books-, notes-, weather-analytics-events.apple.com | App analytics |
| Meta | connect.facebook.net, pixel.facebook.com | The Meta Pixel on other sites |
| | an.facebook.com | Audience Network (Meta's ads inside other apps) |
| Amazon | amazon-adsystem.com | Amazon's ads on other sites and apps |
| | device-metrics-us(-2).amazon.com, unagi(-na).amazon.com | Fire TV, Echo, Kindle and app usage reports |
| Microsoft | vortex(-win).data.microsoft.com, mobile.events.data.microsoft.com, browser.events.data.msn.com, telemetry.microsoft.com | Windows, Office, Teams and Edge telemetry |
| | bat.bing.com, adnxs.com | Bing ads tag, Xandr ad exchange |
| | clarity.ms | Microsoft Clarity, which records visits to other sites |
| | px.ads.linkedin.com, dc.ads.linkedin.com, snap.licdn.com | LinkedIn Insight Tag |
| ByteDance | analytics.tiktok.com, analytics-sg.tiktok.com | TikTok Pixel |
| | pangle.io, pangleglobal.com | Pangle, ByteDance's ads inside other apps |
| X | ads-twitter.com | X Pixel and conversion tag |

## What must keep working (114 domains)

[`blocklists/big-tech-trackers/allow.txt`](../blocklists/big-tech-trackers/allow.txt) lists every address Beyond's own
products call, found by reading the code of gobeyond.nz, Beyond Family and Spaces, Beyond TV, Beyond Gateway and Agent HQ
on 25/10/2026, plus what devices need. Highlights:

- **Devices saying they're online:** connectivitycheck.gstatic.com, clients3.google.com (Android, Google TV), captive.apple.com (Apple), www.msftconnecttest.com (Windows). Block these and devices say "no internet".
- **Google:** sign-in, googleapis (Business Profile, maps, notifications, Play), fonts, YouTube, Google Play and dl.google.com (installing Beyond TV), the Analytics and Tag Manager *dashboards*, Google Ads (Beyond Growth).
- **Apple:** apple.com as a whole (App Store, TestFlight for Beyond Spaces builds, developer, sign-in), push notifications, iCloud.
- **Meta:** facebook.com, graph.facebook.com (socials hub posting), Business Suite, Ads Manager, the developer site, Instagram, Threads, WhatsApp and their picture servers.
- **Microsoft and LinkedIn:** LinkedIn and its API (socials hub posting), sign-in, Windows Update and the settings it relies on.
- **TikTok:** the app, Ads Manager and the business API (Beyond Growth), posting API.
- **X:** x.com and its APIs (socials hub), picture servers.
- **Beyond and its services:** gobeyond.nz, beyondfamily.app, beyondspaces.nz, Vercel, Supabase, AWS (amazonaws.com), Render, Resend, Cloudflare, GitHub (Gateway updates), Canva, Stripe (including m.stripe.network, its card checks), Xero, SiteHost, Slack, Plausible, PB Tech, Unitree, Claude, TMDB, Watchmode, Plex, Open-Meteo.

`tests/trackers.test.mjs` fails the build if a domain is in both lists, if the built files are out of date, or if a new
block lands *inside* an allowed domain without being added to its short "on purpose" list (today: the Google Analytics
collector inside analytics.google.com, the Apple ad and analytics names inside apple.com, and the Pixel and Audience
Network inside facebook.com).

## Flagged, decided on the safe side

These were judgement calls. Each errs towards nothing breaking.

1. **Beyond Family's own analytics.** Beyond Family loads Google Analytics, Tag Manager and the TikTok Pixel
   (`client/src/lib/analytics.ts`). They're blocked: the app loads them fire and forget, so it keeps working, but visits
   from a house with the switch on won't show in Beyond Family's GA or TikTok numbers, and the Engine Room's "collecting"
   badge reads from those. gobeyond.nz uses Plausible, which isn't blocked.
2. **Free TV apps' ad breaks.** pubads.g.doubleclick.net (ad breaks), dai.google.com (streams with ads stitched in) and
   imasdk.googleapis.com (the video ad player) stay allowed, because some streaming apps stop playing rather than skip an
   ad they can't fetch. pubads is the one exception carved out of doubleclick.net. Not yet tested on a real TV with
   TVNZ+ or ThreeNow: worth a try on a Google TV with the switch on, and if they play fine without it, move pubads to
   blocked.
3. **"Log in with Facebook" on other sites.** connect.facebook.net carries both the Pixel and Facebook's login and
   comment-box script, so those buttons can go missing on third-party sites while the switch is on. Beyond's sites don't
   use it. Kept blocked because it's the Pixel's main address; if families complain, move it to allowed.
4. **Left alone on purpose:** anything under googleapis.com beyond what's listed, xp.apple.com, Xbox and TikTok app
   telemetry, and analytics.twitter.com. Blocking those risks breaking the apps themselves or Kyle's own business
   dashboards.

## How it works on the router

- The source is `blocklists/big-tech-trackers/block.txt` and `allow.txt`. `node tools/trackers.mjs` builds:
  - `files/usr/share/beyond/big-tech-trackers.conf`: a dnsmasq servers-file. `server=/doubleclick.net/` answers "no such
    name" for it and everything under it; `server=/pubads.g.doubleclick.net/#` sends that one on as usual.
  - `blocklists/big-tech-trackers/adguard.txt`: the same for AdGuard Home (Beyond Shield, Beyond Hub) and Pi-hole, with
    `@@` exceptions.
  - `blocklists/big-tech-trackers/hosts.txt`: a plain hosts file for anything else (exact names only).
- The switch is `beyond.privacy.block_trackers` (UCI, `/etc/config/beyond`), `0` by default. The app calls
  `privacy_set`, which sets it and runs `files/usr/libexec/beyond/apply-trackers`. That sets or removes
  `dhcp.@dnsmasq[0].serversfile` and restarts DNS only when something changed. It never touches a servers-file someone
  set up themselves (their own ad blocker in Advanced settings): the switch then stays off and the card says why.
- At boot the init script runs `apply-trackers` again, so if an update ever drops the list, DNS stops pointing at it.
- Each Gateway update ships the newest list, since it lives in `/usr/share`, not in the settings that updates keep.

## How to toggle it

- **In the app:** *Settings*, **Block Big Tech trackers**, flick the switch. Off puts everything back straight away.
- **Over SSH:** `uci set beyond.privacy.block_trackers=1 && uci commit beyond && /usr/libexec/beyond/apply-trackers`
  (`=0` to turn it off).
- **AdGuard Home (Shield, Hub):** *Filters*, *DNS blocklists*, *Add blocklist*, *Add a custom list*, with the raw URL of
  `blocklists/big-tech-trackers/adguard.txt` on the `main` branch. Untick it to turn it off.

## Limits

- DNS blocking can't see inside a site: it stops whole addresses, never a path like facebook.com/tr.
- Devices that look up addresses their own private way (Chrome or Firefox "secure DNS", iCloud Private Relay, a VPN)
  skip the router, so the block doesn't reach them.
- The ucode and the switch haven't run on a real router yet (no OpenWrt in the build sandbox). The first real router is
  the first run.

## Changing the list

Edit `block.txt` or `allow.txt` (one domain per line, a note after `#`), run `node tools/trackers.mjs`, then
`sh tests/run.sh`. Adding a company: add it to the website's tech fines tracker first, with a source, then here under its
own `# Company` heading.
