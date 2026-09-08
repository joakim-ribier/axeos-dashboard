---
title: Home
layout: home
permalink: /en/
nav_exclude: true
lang: en
subnav:
  - title: Supported models
    anchor: supported-models
---

# axeos-dashboard

**axeos-dashboard** is a local dashboard that brings together the
stats for all your Bitcoin ASIC miners compatible with
[AxeOs](https://github.com/skot/ESP-Miner) (Bitaxe, NerdQAxe...) in one
place — hashrate, temperature, fans, pools, and more — without having
to open each device's own interface one by one.

Designed to run on a Raspberry Pi or any machine on your local network.
No authentication required — internal LAN use only.

[Get started with Installation]({{ '/installation.html' | relative_url }}){: .btn .btn-primary }
*(currently French only — translation coming soon)*

{: .note }
> **Remote monitoring** — Export your data to the cloud to keep an eye
> on your miners from anywhere in the world, no VPN needed, via
> [hashboard.live](https://hashboard.live).

![axeos-dashboard preview]({{ '/assets/images/dashboard-screenshot.png' | relative_url }})

## Key features

### Home

- Overview of all your miners: hashrate, temperature, fans, shares,
  uptime...
- Lifetime totals (uptime + accepted shares)
- Primary and fallback pool view, one click away
- Switch pool and restart on demand
- New firmware version detection
- New dashboard version detection

### Settings

- Automatic network discovery of miners
- Pool configuration
- Cron-based scheduler to switch pools or restart automatically
- Electricity rate setting

### Alerts

- Dedicated alerts page (temperature, fan, offline, config, firmware...)

---

## Supported models
{: #supported-models }

Tested firmware, up to these versions:

- **Bitaxe Gamma** — [v2.15.1](https://github.com/bitaxeorg/esp-miner/releases/tag/v2.15.1){:target="_blank" rel="noopener noreferrer"}
- **NerdQAxe++** — [V1.0.37.3-LTS](https://github.com/shufps/ESP-Miner-NerdQAxePlus/releases/tag/v1.0.37.3-LTS){:target="_blank" rel="noopener noreferrer"}
