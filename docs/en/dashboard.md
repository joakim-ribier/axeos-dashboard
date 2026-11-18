---
title: Home screen
nav_order: 3
group: Pages
lang: en
subnav:
  - title: Menu
    anchor: sidebar
  - title: Top bar
    anchor: top-bar
  - title: The fleet
    anchor: fleet
  - title: Miner status & pools
    anchor: status-pools
  - title: Search, filters & sort
    anchor: search-filters-sort
  - title: The miners' list
    anchor: list
  - title: A miner's detail
    anchor: details
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#sidebar" class="toc-card">
    <span class="toc-card-icon">☰</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Menu</span>
      <span class="toc-card-sub">The pages, your board and the services' state</span>
    </span>
  </a>
  <a href="#top-bar" class="toc-card">
    <span class="toc-card-icon">🔔</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Top bar</span>
      <span class="toc-card-sub">Docs, refresh, notifications, language</span>
    </span>
  </a>
  <a href="#fleet" class="toc-card">
    <span class="toc-card-icon">📊</span>
    <span class="toc-card-text">
      <span class="toc-card-title">The fleet</span>
      <span class="toc-card-sub">24 h hashrate, power, cost, shares</span>
    </span>
  </a>
  <a href="#status-pools" class="toc-card">
    <span class="toc-card-icon">🚦</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Status & pools</span>
      <span class="toc-card-sub">Your miners by state, the hashrate by pool</span>
    </span>
  </a>
  <a href="#search-filters-sort" class="toc-card">
    <span class="toc-card-icon">🔍</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Search & sort</span>
      <span class="toc-card-sub">Find a miner, order the list</span>
    </span>
  </a>
  <a href="#list" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-text">
      <span class="toc-card-title">The list</span>
      <span class="toc-card-sub">Each miner on a row, or as tiles</span>
    </span>
  </a>
  <a href="#details" class="toc-card">
    <span class="toc-card-icon">🔎</span>
    <span class="toc-card-text">
      <span class="toc-card-title">The detail</span>
      <span class="toc-card-sub">All about a miner, restart and switch</span>
    </span>
  </a>
</div>

## ☰ Menu
{: #sidebar }

<div class="shot-aside" markdown="1">

![Menu]({{ '/assets/images/sidebar-only.png' | relative_url }}){: width="225" }

1. AxeOS · D#hashboard — reloads the app and goes back home.
2. [hashboard board]({{ '/en/hashboard.html' | relative_url }}){: .link-page } —
   once sending to hashboard is set up: the board's ID (click to open it),
   public or private, and a link to your account.
3. Home — all your miners.
4. [Alerts]({{ '/en/alerts.html' | relative_url }}){: .link-page } — in
   progress and history; the badge counts those in progress.
5. [Configuration]({{ '/en/configuration.html' | relative_url }}){: .link-page } —
   miners, electricity, notifications, remote, system.
6. [Backups]({{ '/en/backups.html' | relative_url }}){: .link-page } — the
   history's monthly archives.
7. [Audit]({{ '/en/audit.html' | relative_url }}){: .link-page } — everything
   that acts on a miner or on the configuration.
8. Platform status — green when everything runs, orange when a service
   missed a run, red when one doesn't answer.
   [The detail](#platform-status){: .link-page }
9. Menu footer — the deployed version, "Update available" when a new
   version is out (click to open the release), and the button folding the
   menu into a column of icons.

</div>

On a phone, the menu opens with the ☰ button of the top bar.

### Platform status
{: #platform-status }

A click on *Platform status* shows each service's state, read again every
time it opens:

![Services status]({{ '/assets/images/services-status.png' | relative_url }}){: width="347" }

A service is *Late* when it did nothing for two intervals, *Unreachable*
when it doesn't answer, and *No run yet* until it has run.

---

## 🔔 Top bar
{: #top-bar }

Always there, even when scrolling the page.

![Top bar]({{ '/assets/images/topbar-only.png' | relative_url }}){: width="736" }

1. Page — the page's icon, title and description.
2. Documentation — opens these docs.
3. Auto refresh — turns the data's refresh on (blue) or off (grey); kept by
   the browser.
4. Notifications — the alerts that start or end, and recent events; the
   badge counts the unread ones. A click marks them read on every device.
5. Language — French or English.

On a phone, the bar keeps the essentials:

![Top bar on a phone]({{ '/assets/images/topbar-mobile.png' | relative_url }}){: width="287" }

1. Menu — opens the menu.
2. Page — its icon and title.
3. Auto refresh
4. Notifications
5. More — unfolds the docs and the language under the bar.

---

## 📊 The fleet
{: #fleet }

![The fleet]({{ '/assets/images/fleet.png' | relative_url }}){: width="736" }

1. Fleet hashrate · 24 h — the output of all your miners.
2. Health — the miners with no problem out of the total, in the color of the
   most urgent problem. A click unfolds every miner, the ones with a problem
   first; a click on one opens its detail.
   [A miner's detail](#details){: .link-page }

   ![Miners under the health chip]({{ '/assets/images/fleet-health.png' | relative_url }}){: width="259" }

3. Last poll — its time. Red when it's older than 2 intervals: the feeder
   no longer runs.
4. Current hashrate — the reachable miners', and the 24 h average.
5. 24 h chart — the fleet's hashrate in 15-minute slices; a time with no
   poll shows in grey.
6. Power — the total draw; below, the miner drawing the least ↓ and the
   most ↑.
7. Efficiency — the fleet's efficiency (J/TH); below, the best ↓ and the
   worst ↑.
8. Electricity — the cost per day at the set rate, miners and other devices
   included; below, the total spent since the start, which a change of rate
   doesn't alter.
   [Configuration › Electricity]({{ '/en/configuration.html#electricity' | relative_url }}){: .link-page }
9. Shares — the shares accepted since the miners started; below, since their
   very first start.
10. Best diff — the best difficulty, and the miner holding it.
11. Temperature — the chips' lowest ↓ and highest ↑; below, the fastest fan.

---

## 🚦 Miner status & pools
{: #status-pools }

![Miner status and pools]({{ '/assets/images/breakdowns.png' | relative_url }}){: width="736" }

1. Miner status — how your miners split, the most urgent first:
   - Offline — the miner no longer answers.
   - Config error — the configured MAC isn't the miner's (wrong device at
     this IP, or a typo).
   - Late — the miner answers, but no poll for more than 2 intervals.
   - Alert — temperature or fan above the threshold (62 °C and 75 % by
     default), until back to normal.
   - Online — all is well.
2. Pools — each pool's share of the hashrate.

Each chip filters the list below; a second click removes the filter.

---

## 🔍 Search, filters & sort
{: #search-filters-sort }

![Search, filters and sort]({{ '/assets/images/toolbar.png' | relative_url }}){: width="736" }

1. Search — text (name, IP, model, pool, user, firmware) or comparisons:
   `temp>60`, `fan<=50`, `power>15`, `hashrate<0.3`, `uptime>3600`
   (seconds), `offline`. Several terms add up; `-` or `!` before a term
   excludes it.
2. Tips — a reminder of this syntax.
3. Sort — hottest (default), hashrate, fan, shares, oldest or pool. The
   miners with a problem always stay first.
4. Model — a filter per type of miner, with their count.
5. Firmware — a filter per version, with their count.
6. View — list or tiles; always tiles on a phone.
7. Counter — the miners shown out of the total.

The sort and the view are kept from one visit to the next.

---

## 📋 The miners' list
{: #list }

![The miners' list]({{ '/assets/images/miner-list.png' | relative_url }}){: width="736" }

1. Miner — its name, its IP and its model.
2. Hashrate · 24 h — the last 24 h's curve and the current value; in red on
   the baseline, the times it didn't answer.
3. Chip temp — on a green gauge, yellow near the threshold (the mark,
   62 °C by default), red during the alert.
4. Fan — the same gauge, with its threshold (75 % by default).
5. Power — draw (W) and efficiency (J/TH).
6. Pool — the active pool, primary or fallback; clickable to its dashboard
   when a link is known.
   [Configuration › System]({{ '/en/configuration.html#system' | relative_url }}){: .link-page }
7. Firmware — the installed version; in blue below, the new one if there is
   one.
8. State — the stripe on the left, in the color of the miner's state.
   [Miner status](#status-pools){: .link-page }
9. Detail — a click on the row opens the miner's detail.
   [A miner's detail](#details){: .link-page }

As tiles, the same information, with the state written out:

![The miners as tiles]({{ '/assets/images/miner-tiles.png' | relative_url }}){: width="495" }

---

## 🔎 A miner's detail
{: #details }

A panel on the right, full screen on a phone. It closes with the cross, a
click beside it, or a swipe to the right.

<div class="shot-aside" markdown="1">

![A miner's detail]({{ '/assets/images/drawer.png' | relative_url }}){: width="446" }

1. Name and state — the top stripe in the state's color.
2. IP — opens the miner's interface; then its model.
3. Readings — 24 h hashrate, power and efficiency, temperature and fan with
   their threshold.
4. Last 24 h — temperature, fan, hashrate or ping, over 1 h or 24 h.
5. Pools — the primary and the fallback, the active one marked; each
   clickable to its dashboard when a link is known.
6. User — the chosen pool's user, copied in one click; a click on the other
   pool shows its own.
7. Session — accepted and rejected shares, best difficulty and uptime since
   the last restart.
8. Since tracking began — shares, uptime and electricity since the very
   first start.
9. Device — firmware, MAC, pool ping and last poll.
10. Actions — restart the miner or switch it to its other pool (it restarts
    to apply it), always after a confirmation.

</div>

When the miner has a problem, a banner describes it under the header:
unreachable, no poll since a given time, configuration error, temperature
or fan at the threshold — or back under the threshold without being back to
normal yet, with the value to reach. A new firmware version shows in a blue
banner, with the link to its release.

{% include page_nav.html position="bottom" %}
