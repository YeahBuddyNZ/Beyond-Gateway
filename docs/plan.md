# The plan

The full research (bases compared, NZ ISP settings, licences) is the Beyond Gateway plan: https://claude.ai/artifact/8QPBnqe1tTTiiVaNz9at3Y

Decided 22/10/2026 (Kyle): OpenWrt underneath, our own Beyond app on top, on a router we recommend. ISP routers are not flashed.

| Stage | What |
|---|---|
| 0. Shield | AdGuard Home on a Beyond Box, works with any ISP router |
| 1. Gateway core | This repo today: the image, finding the internet by itself, setup, home, devices, pause, Wi-Fi, the way back |
| 2. The app, more | Guest Wi-Fi with a QR code, speed test, "is it the internet or us?", self-updates from our own package feed (one OK press, never silent) |
| 3. Beyond Family | Devices under each person in their colour, bedtime pause, alerts to Beyond TV and the phone |
| 4. Mesh | Built 23/10/2026: up to 10 more Beyond routers of any make join the main one by cable as mesh points, take its Wi-Fi each minute, and roam with 802.11k/v and usteer. Next: joining over Wi-Fi alone (802.11s), where the hardware allows |
| 5. Security | Beyond Shield built in, new device alerts, bad address blocking, WireGuard for away from home |
| 6. Your own router | An installer for routers people already own that OpenWrt supports |
