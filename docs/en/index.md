---
title: Home
layout: home
nav_order: 1
permalink: /en/
nav_exclude: true
lang: en
subnav:
  - title: Architecture
    anchor: architecture
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

[Get started with Installation]({{ '/en/installation.html' | relative_url }}){: .btn .btn-primary }

{: .note }
> 💡 **Tip** — export your data to the cloud to keep an eye on your
> miners from anywhere in the world, no VPN needed, via
> [hashboard.live](https://hashboard.live).

![axeos-dashboard preview]({{ '/assets/images/dashboard-screenshot.png' | relative_url }})

---

## Key features

### Home

- Overview of all your miners: hashrate, temperature, fans, shares,
  uptime...
- Lifetime totals (uptime + accepted shares)
- Primary and fallback pool view, one click away
- Switch pool and restart on demand
- New firmware version detection
- New dashboard version detection

[See the Home screen in detail]({{ '/en/dashboard.html' | relative_url }}){: .btn .btn-primary }

### Settings

- Automatic network discovery of miners
- Pool configuration
- Cron-based scheduler to switch pools or restart automatically
- Electricity rate setting

[See Configuration in detail]({{ '/en/configuration.html' | relative_url }}){: .btn .btn-primary }

### Alerts

- Dedicated alerts page (temperature, fan, offline, config, firmware...)

---

## Architecture

<div class="arch-diagram">
<svg viewBox="0 0 860 610" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Architecture diagram: Feeder and Dashboard API (Go) and UI (React) running on a Raspberry Pi, talking to the miners and local storage, accessed from a browser">
  <defs>
    <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#5a6472"></path>
    </marker>
  </defs>

  <rect x="20" y="20" width="820" height="490" rx="16" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="5 5"></rect>
  <text x="42" y="46" fill="#8892a4" font-size="12" font-weight="700" letter-spacing="1">LOCAL NETWORK</text>

  <rect x="48" y="70" width="440" height="400" rx="14" fill="#1e1e2a" stroke="rgba(0,180,255,0.45)" stroke-width="1.5"></rect>
  <text x="70" y="98" fill="#8892a4" font-size="12" font-weight="700">Raspberry Pi (or any machine)</text>

  <!-- Feeder -->
  <rect x="68" y="112" width="400" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="268" y="138" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Feeder</text>
  <text x="268" y="158" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go</text>

  <!-- Storage -->
  <rect x="68" y="204" width="400" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="268" y="228" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700" font-family="monospace">latest.json + day.jsonl</text>
  <text x="268" y="248" text-anchor="middle" fill="#8892a4" font-size="12">Local storage (disk)</text>

  <!-- Dashboard API -->
  <rect x="68" y="296" width="400" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="268" y="322" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Dashboard API</text>
  <text x="268" y="342" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go · chi</text>

  <!-- UI -->
  <rect x="68" y="388" width="400" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="268" y="414" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">UI</text>
  <text x="268" y="434" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">React · nginx</text>

  <!-- Miners -->
  <rect x="545" y="90" width="255" height="72" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="672" y="119" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Bitaxe</text>
  <text x="672" y="139" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <rect x="545" y="240" width="255" height="72" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="672" y="269" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Bitaxe</text>
  <text x="672" y="289" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <rect x="545" y="390" width="255" height="72" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="672" y="419" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">NerdQAxe</text>
  <text x="672" y="439" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <!-- Browser -->
  <rect x="48" y="540" width="210" height="56" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="153" y="574" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Browser</text>

  <!-- Feeder -> miners (polling) -->
  <path d="M468,144 L545,126" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M468,144 L545,276" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M468,144 L545,426" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="486" y="188" fill="#8892a4" font-size="11" font-family="monospace">GET /api/system/info</text>
  <text x="486" y="202" fill="#8892a4" font-size="11">every 2 min</text>

  <!-- Dashboard API -> miners (control actions) -->
  <path d="M468,320 L545,276" fill="none" stroke="#ffa726" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arch-arrow)"></path>
  <text x="486" y="240" fill="#ffa726" font-size="11" font-family="monospace">POST switch / restart</text>
  <text x="486" y="254" fill="#8892a4" font-size="11">control, on demand</text>

  <!-- Feeder -> Storage (write) -->
  <path d="M268,176 L268,204" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="300" y="194" fill="#8892a4" font-size="11">write</text>

  <!-- Dashboard API -> Storage (read) -->
  <path d="M268,296 L268,268" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="300" y="286" fill="#8892a4" font-size="11">read</text>

  <!-- UI -> Dashboard API -->
  <path d="M320,388 L320,360" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="336" y="378" fill="#8892a4" font-size="11">/api/*</text>

  <!-- Browser -> UI -->
  <path d="M178,540 L245,452" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="185" y="500" fill="#8892a4" font-size="11">HTTP</text>
</svg>
</div>

### Feeder

A service that runs continuously against the registered miners'
configuration. It polls each miner every 2 minutes (server-side
configurable interval), and records the result in two places:
`latest.json`, the miner's latest state, and a `.jsonl` file, the
history of every poll, stored per day.

### Dashboard (API + UI)

The dashboard is made of an API and a web interface. It never talks
directly to the miners — its job is mainly to serve the information
already stored by the feeder (`latest.json` and the day's history), and
to proxy the few control actions (pool switch, restart) to the miners.

---

## Supported models
{: #supported-models }

Tested firmware, up to these versions:

- **Bitaxe Gamma** — [v2.15.1](https://github.com/bitaxeorg/esp-miner/releases/tag/v2.15.1){:target="_blank" rel="noopener noreferrer"}
- **NerdQAxe++** — [v1.0.37.3-LTS](https://github.com/shufps/ESP-Miner-NerdQAxePlus/releases/tag/v1.0.37.3-LTS){:target="_blank" rel="noopener noreferrer"}
