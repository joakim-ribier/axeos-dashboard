---
title: Hashboard
nav_order: 6.9
group: Services
lang: en
subnav:
  - title: How it works
    anchor: how-it-works
  - title: Remote actions
    anchor: remote-actions
  - title: Data protection
    anchor: data-protection
  - title: In the dashboard
    anchor: in-the-dashboard
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#how-it-works" class="toc-card">
    <span class="toc-card-icon">🔄</span>
    <span class="toc-card-text">
      <span class="toc-card-title">How it works</span>
      <span class="toc-card-sub">What your dashboard sends</span>
    </span>
  </a>
  <a href="#remote-actions" class="toc-card">
    <span class="toc-card-icon">🕹️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Remote actions</span>
      <span class="toc-card-sub">Restart or switch from your board</span>
    </span>
  </a>
  <a href="#data-protection" class="toc-card">
    <span class="toc-card-icon">🔒</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Data protection</span>
      <span class="toc-card-sub">What stays at home</span>
    </span>
  </a>
  <a href="#in-the-dashboard" class="toc-card">
    <span class="toc-card-icon">🧭</span>
    <span class="toc-card-text">
      <span class="toc-card-title">In the dashboard</span>
      <span class="toc-card-sub">Where your board shows</span>
    </span>
  </a>
</div>

Your miners followed from anywhere: your dashboard sends their stats to
[hashboard.live](https://hashboard.live){:target="_blank" rel="noopener noreferrer"},
which shows them on your board — 24 h hashrate, indicators, miner status,
pools and list, refreshed on their own, in the browser's language. Your
board is public or private.

No port nor VPN to open: your dashboard is the one sending, hashboard never
connects to it.
[Configuration › Remote]({{ '/en/configuration.html#remote' | relative_url }}){: .link-page }

Your personal data stays at home. By default, your wallet, your pools and
your miners' addresses on your network are hidden before sending: hashboard
doesn't receive them, doesn't store them, and so can't show them, even on a
public board.
{: .lead-privacy }

---

## 🔄 How it works
{: #how-it-works }

Once sending is set up, the feeder sends on every cycle, for each miner:

- the poll — the readings, the name, the model, the kWh rate, the latest
  firmware release, the feeder's interval and the alert thresholds, the
  personal data hidden;
- the totals — uptime, shares, electricity cost;
- an "offline" line when the miner doesn't answer: the board's 24 h chart
  drops to 0, like locally.

And, for the whole board, its settings: the remote actions allowed, sent
when they change.

A board holds a limited number of miners, set by hashboard. Beyond it, only
the first enabled miners, in the configuration's order, are sent; the others
stay polled and watched locally, and Configuration › Remote names them.

The sends go out in the background: a slow hashboard doesn't hold up the
cycle, a failure is written to the logs.
[Feeder › Push to hashboard]({{ '/en/feeder.html#hashboard' | relative_url }}){: .link-page }

---

## 🕹️ Remote actions
{: #remote-actions }

On a private board, a miner's detail keeps its *Restart* and *Switch*
buttons, for the actions you allow.

1. Your board leaves the request on hashboard.
2. Your dashboard picks it up within a minute — it asks hashboard nothing
   while no action is allowed.
3. It checks the action is still allowed and the miner is one of yours, does
   it like its own buttons and writes it to the audit.
4. The board shows *Request pending*, then *Request picked up* with the time,
   buttons greyed out. A request not picked up in time expires without being
   done.

One request at a time per miner. The outcome is in the audit, and in a mail
if you turn it on.
[Configuration › Remote]({{ '/en/configuration.html#remote' | relative_url }}){: .link-page }

---

## 🔒 Data protection
{: #data-protection }

Your wallet, your pools and your local network are personal data. Before each
send, your dashboard hides them: the field stays, its value becomes
`xxxxxxxx` (`0` for a port). hashboard never receives the data, and the board
doesn't show it.

### Always hidden

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
      <td>The miner's IPv6 address</td>
      <td><code>xxxxxxxx</code></td>
    </tr>
  </tbody>
</table>

### Hidden by default

To share only if you choose to, in Configuration › Remote:

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
      <td>a made-up address from the MAC: <code>aa:bb:cc:dd:ee:ff</code> becomes <code>fd00::aabb:ccdd:eeff</code></td>
      <td>each miner's IP on your network</td>
    </tr>
  </tbody>
</table>

The made-up address says nothing about your network: it only lets the board
recognise each miner. Only what's sent is hidden: your dashboard keeps
everything locally — home screen, history, backups, audit.

---

## 🧭 In the dashboard
{: #in-the-dashboard }

Once sending is set up, your board shows in the dashboard:

- Menu — under *AxeOS · D#hashboard*, the board's ID (click to open it),
  public or private, and a link to your hashboard account.
- Home screen — under the page's title, *Open your board* and the time of
  the last data received by hashboard.

{% include page_nav.html position="bottom" %}
