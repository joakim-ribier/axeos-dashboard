---
title: Hashboard
nav_order: 10.5
group: Remote
lang: en
subnav:
  - title: How it works
    anchor: how-it-works
  - title: Data protection
    anchor: data-protection
  - title: In the dashboard
    anchor: in-the-dashboard
---

# Hashboard

<div class="toc-grid">
  <a href="#how-it-works" class="toc-card">
    <span class="toc-card-icon">🔄</span>
    <span class="toc-card-title">How it works</span>
  </a>
  <a href="#data-protection" class="toc-card">
    <span class="toc-card-icon">🔒</span>
    <span class="toc-card-title">Data protection</span>
  </a>
  <a href="#in-the-dashboard" class="toc-card">
    <span class="toc-card-icon">🧭</span>
    <span class="toc-card-title">In the dashboard</span>
  </a>
</div>

Follow your miners from anywhere: the dashboard sends their stats to
[hashboard.live](https://hashboard.live), which shows them on your board.

The board is your fleet's home page, reachable away from home — 24h
hashrate, KPIs, miners' status, pools and the miner list — refreshed
automatically, in the browser's language. It can be public or private.

Nothing to open on your network, no port and no VPN: your dashboard does
the sending, hashboard never connects to it. The push is set up in
Settings › Remote.

[Go to Remote →]({{ '/en/configuration.html#remote' | relative_url }}){: .btn .btn-primary }

{: .protection }
> 🔒 **Your personal data stays with you.** hashboard is a third-party
> service. By default, your wallet, your pools and your miners' address on
> your local network are obfuscated before the push: hashboard doesn't
> receive them, doesn't store them and so can never expose them, not even
> on a public board.

---

## 🔄 How it works
{: #how-it-works }

Once the push is set up, the feeder sends hashboard, on each cycle and
for each miner:

- **the reading** — the measurements, the name (or alias), the model, the
  kWh rate, the firmware's latest release and the feeder's interval, with
  the personal data obfuscated;
- **the totals** — uptime, accepted and rejected shares, electricity
  cost;
- **an "offline" line** when the miner doesn't answer: the board's 24h
  chart dips to 0 as it does locally.

Pushes run in the background: a slow or unreachable hashboard never
delays the cycle, the failure is written to the logs. A changed setting
applies on the next cycle.

[See the details in Feeder →]({{ '/en/feeder.html#hashboard' | relative_url }}){: .btn .btn-primary }

---

## 🔒 Data protection
{: #data-protection }

Your wallet, your pools and your local network are personal data. Before
each push, the dashboard **obfuscates** them: the field stays, its value
is replaced by `xxxxxxxx` (`0` for a port) — so hashboard never
receives the data, and the board doesn't show it.

### Always obfuscated

<table class="data-table">
  <thead>
    <tr>
      <th>Data</th>
      <th>Sent to hashboard</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Wi-Fi network name</td>
      <td><code>xxxxxxxx</code></td>
    </tr>
    <tr>
      <td>Miner's IPv6 address</td>
      <td><code>xxxxxxxx</code></td>
    </tr>
  </tbody>
</table>

### Obfuscated by default

Shared only if you choose to, in Settings › Remote:

<table class="data-table">
  <thead>
    <tr>
      <th>Setting</th>
      <th>Off (default)</th>
      <th>On</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Pools' user / wallet</td>
      <td><code>xxxxxxxx</code></td>
      <td>the primary and fallback pools' user</td>
    </tr>
    <tr>
      <td>Pools (address and port)</td>
      <td><code>xxxxxxxx</code>, port <code>0</code></td>
      <td>the primary and fallback pools' address and port</td>
    </tr>
    <tr>
      <td>Miners' IP address</td>
      <td>a made-up address derived from the MAC address: <code>aa:bb:cc:dd:ee:ff</code> becomes <code>fd00::aabb:ccdd:eeff</code></td>
      <td>each miner's IP on your network</td>
    </tr>
  </tbody>
</table>

The made-up address says nothing about your network: it only lets the
board recognize each miner, and it's what the board shows.

Only the push is obfuscated: your dashboard keeps all the data locally —
home, history, backups, audit.

---

## 🧭 In the dashboard
{: #in-the-dashboard }

Once the push is set up, your board shows in the dashboard itself:

- **Menu** — under *AxeOS · D#hashboard*, the board ID (click to open the
  board), whether it's public or private, and a link to your hashboard
  account.
- **Home** — under the page title, an *Open the remote board* link and
  when hashboard last received data.
