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

{% include page_nav.html position="top" %}

[Latest version: 0.1.0 — what's new]({{ '/en/release-v0.1.0.html' | relative_url }}){: .link-page }
{: .release-line }

All your Bitcoin ASIC miners' stats
[AxeOS](https://github.com/skot/ESP-Miner){:target="_blank" rel="noopener noreferrer"} (Bitaxe, NerdQAxe…) in one place —
hashrate, temperature, fans, pools and more — without opening each
device's interface one by one.

Everything runs at home, on a Raspberry Pi or any machine on your local
network: your miners' history, your configuration and your settings stay on
your machine. No account to create, you use it from your local network.
{: .lead-privacy }

To follow your miners away from home, you can turn on sending to
[hashboard.forlovers.app](https://hashboard.forlovers.app){:target="_blank" rel="noopener noreferrer"}: only their stats go out
(hashrate, temperatures, shares…), your wallet, your pools and your network's
addresses stay hidden, unless you choose to share them.
[Learn more]({{ '/en/hashboard.html' | relative_url }}){: .link-page }

[Get started with the installation]({{ '/en/installation.html' | relative_url }}){: .btn .btn-quiet }

![Dashboard overview]({{ '/assets/images/dashboard-screenshot.png' | relative_url }})
{: .shot-hero }

---

## Key features

### [Home screen]({{ '/en/dashboard.html' | relative_url }}){: .link-heading }

- The fleet at a glance: hashrate over the last 24 h, power, efficiency,
  electricity cost per day and since the start, shares, best difficulty,
  temperature
- Each miner's state and each pool's share, which double as quick filters
- Your miners as a list or tiles, with search, filters and sort — the
  miners with a problem first
- A miner's detail in one click: 24 h chart, pools, session and all-time
  totals, restart and pool switch
- New firmware versions for each miner, and for the dashboard
- Each of the platform's services' state, at the bottom of the menu

### [Configuration]({{ '/en/configuration.html' | relative_url }}){: .link-heading }

- Miners detected on the network, or added by IP
- For each miner: display name, primary and fallback pools, alert
  thresholds, scheduler (pool switch or restart at a set time)
- Each miner's pools checked, and the whole fleet switched to a pool at once
- Electricity rate and other devices (fan, router…) for the whole install's
  daily cost
- Mails: SMTP server, recipients, audit report (every day, every 2 days,
  every week or every month), a mail on every new alert, editable texts
- Alert thresholds common to every miner, pool dashboards

### [Alerts]({{ '/en/alerts.html' | relative_url }}){: .link-heading }

- Your miners' alerts in progress: offline, configuration error,
  temperature, fan, new firmware
- Each day's history, filtered by miner and by type
- Each alert is raised once, and ends when the value drops back under its
  threshold minus a margin
- A mail on every new alert, if you turn it on

### [Backups]({{ '/en/backups.html' | relative_url }}){: .link-heading }

- Your miners' history archived automatically: one zip per month, added to
  every night
- The checksum of each completed month
- One month or several downloaded at once

### [Audit]({{ '/en/audit.html' | relative_url }}){: .link-heading }

- Everything that acts on a miner or on the configuration: restarts, pool
  switches, saved settings, network detections, downloads, remote actions
- From the dashboard (with the IP and the browser), or by the application
  itself (scheduler, backup, mails)
- Filters by miner, type and day, JSON export, report by mail

---

## Architecture

<div class="arch-diagram">
<svg viewBox="0 0 960 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Architecture diagram: on the local network, a Raspberry Pi runs the Feeder, the Mailer, the Dashboard API and the UI around a local storage, polls the miners and hands them the actions; on the Internet, a VPS runs hashboard and the board, which receive the feeder's stats, and the SMTP server receives the mails">
  <defs>
    <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#5a6472"></path>
    </marker>
    <marker id="arch-arrow-action" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#ffa726"></path>
    </marker>
  </defs>

  <!-- Internet -->
  <rect x="20" y="20" width="920" height="186" rx="16" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="5 5"></rect>
  <text x="42" y="46" fill="#8892a4" font-size="12" font-weight="700" letter-spacing="1">INTERNET</text>

  <rect x="40" y="92" width="160" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="120" y="119" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">SMTP server</text>
  <text x="120" y="139" text-anchor="middle" fill="#8892a4" font-size="12">your mails</text>

  <rect x="230" y="60" width="460" height="112" rx="14" fill="#1e1e2a" stroke="rgba(139,124,246,0.55)" stroke-width="1.5"></rect>
  <text x="250" y="82" fill="#8892a4" font-size="12" font-weight="700">VPS — hashboard.forlovers.app</text>

  <rect x="250" y="92" width="200" height="64" rx="10" fill="#262637" stroke="#8b7cf6" stroke-width="1.5"></rect>
  <text x="350" y="119" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">hashboard</text>
  <text x="350" y="139" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go</text>

  <rect x="470" y="92" width="200" height="64" rx="10" fill="#262637" stroke="#8b7cf6" stroke-width="1.5"></rect>
  <text x="570" y="119" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Board</text>
  <text x="570" y="139" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go · React</text>

  <rect x="740" y="92" width="180" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="830" y="119" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Browser</text>
  <text x="830" y="139" text-anchor="middle" fill="#8892a4" font-size="12">anywhere</text>

  <!-- Local network -->
  <rect x="20" y="226" width="920" height="474" rx="16" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="5 5"></rect>
  <text x="918" y="252" text-anchor="end" fill="#8892a4" font-size="12" font-weight="700" letter-spacing="1">LOCAL NETWORK</text>

  <rect x="40" y="266" width="580" height="310" rx="14" fill="#1e1e2a" stroke="rgba(0,180,255,0.45)" stroke-width="1.5"></rect>
  <text x="600" y="292" text-anchor="end" fill="#8892a4" font-size="12" font-weight="700">Raspberry Pi (or any machine)</text>

  <rect x="60" y="306" width="250" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="185" y="333" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Mailer</text>
  <text x="185" y="353" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go</text>

  <rect x="330" y="306" width="270" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="465" y="333" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Feeder</text>
  <text x="465" y="353" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go</text>

  <rect x="60" y="398" width="540" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="330" y="425" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Local storage (disk)</text>
  <text x="330" y="445" text-anchor="middle" fill="#8892a4" font-size="12">history · alerts · audit · archives</text>

  <rect x="60" y="490" width="250" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="185" y="517" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">UI</text>
  <text x="185" y="537" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">React · nginx</text>

  <rect x="330" y="490" width="270" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="465" y="517" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Dashboard API</text>
  <text x="465" y="537" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go · chi</text>

  <rect x="60" y="616" width="250" height="56" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="185" y="640" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Browser</text>
  <text x="185" y="658" text-anchor="middle" fill="#8892a4" font-size="12">local network</text>

  <rect x="740" y="286" width="180" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="830" y="313" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Bitaxe</text>
  <text x="830" y="333" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <rect x="740" y="386" width="180" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="830" y="413" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Bitaxe</text>
  <text x="830" y="433" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <rect x="740" y="486" width="180" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="830" y="513" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">NerdQAxe</text>
  <text x="830" y="533" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <!-- Data: grey -->
  <path d="M600,338 L740,318" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M600,338 L740,418" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M600,338 L740,512" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="634" y="300" fill="#8892a4" font-size="11">poll</text>
  <text x="634" y="314" fill="#8892a4" font-size="11">every 2 min</text>

  <path d="M465,370 L465,398" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="475" y="389" fill="#8892a4" font-size="11">write</text>
  <path d="M185,398 L185,370" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="195" y="389" fill="#8892a4" font-size="11">read</text>
  <path d="M465,462 L465,490" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="475" y="481" fill="#8892a4" font-size="11">read</text>

  <path d="M330,338 L310,338" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M310,522 L330,522" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M185,616 L185,554" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="195" y="590" fill="#8892a4" font-size="11">HTTP</text>

  <path d="M360,306 L350,156" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="366" y="244" fill="#8892a4" font-size="11">stats</text>
  <path d="M120,306 L120,156" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="128" y="244" fill="#8892a4" font-size="11">mails</text>
  <path d="M450,124 L470,124" fill="none" stroke="#5a6472" stroke-width="1.5" marker-start="url(#arch-arrow)"></path>
  <path d="M740,124 L670,124" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="698" y="116" fill="#8892a4" font-size="11">HTTPS</text>

  <!-- Actions: orange -->
  <path d="M600,528 L740,528" fill="none" stroke="#ffa726" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arch-arrow-action)"></path>
  <text x="634" y="548" fill="#ffa726" font-size="11">restart,</text>
  <text x="634" y="562" fill="#ffa726" font-size="11">pool switch</text>
  <path d="M600,506 H612 V186 H430 V156" fill="none" stroke="#ffa726" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arch-arrow-action)"></path>
  <text x="602" y="200" text-anchor="end" fill="#ffa726" font-size="11">board actions · every minute</text>

  <!-- Legend -->
  <path d="M640,620 L680,620" fill="none" stroke="#5a6472" stroke-width="1.5"></path>
  <text x="690" y="624" fill="#8892a4" font-size="11">data</text>
  <path d="M640,644 L680,644" fill="none" stroke="#ffa726" stroke-width="1.5" stroke-dasharray="4 3"></path>
  <text x="690" y="648" fill="#8892a4" font-size="11">actions on the miners</text>
</svg>
</div>

### [Dashboard]({{ '/en/dashboard.html' | relative_url }}){: .link-heading }

The web interface you open in your browser.

### [API]({{ '/en/api.html' | relative_url }}){: .link-heading }

Reads the history the feeder wrote for the interface, and hands your actions
to the miners.

### [Feeder]({{ '/en/feeder.html' | relative_url }}){: .link-heading }

Polls your miners every 2 minutes and writes their history to disk.

### [Mailer]({{ '/en/mailer.html' | relative_url }}){: .link-heading }

Sends every mail through your SMTP server.

### [Hashboard]({{ '/en/hashboard.html' | relative_url }}){: .link-heading }

On a VPS: shows your miners' stats on your board, from anywhere.

---

## Supported models
{: #supported-models }

Firmware tested, up to these versions:

- Bitaxe Gamma — [v2.15.4](https://github.com/bitaxeorg/esp-miner/releases/tag/v2.15.4){:target="_blank" rel="noopener noreferrer"}
- NerdQAxe++ — [v1.1.2](https://github.com/shufps/ESP-Miner-NerdQAxePlus/releases/tag/v1.1.2){:target="_blank" rel="noopener noreferrer"}

{% include page_nav.html position="bottom" %}
