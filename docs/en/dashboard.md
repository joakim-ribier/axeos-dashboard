---
title: Home screen
nav_order: 3
group: Pages
lang: en
subnav:
  - title: Sidebar
    anchor: sidebar
  - title: Top bar
    anchor: top-bar
  - title: Stats bar
    anchor: stats-bar
  - title: Search, filters & sort
    anchor: search-filters-sort
  - title: Miner card
    anchor: miner-card
  - title: Miner card with day chart
    anchor: miner-card-day-chart
---

# Home screen

<div class="toc-grid">
  <a href="#sidebar" class="toc-card">
    <span class="toc-card-icon">☰</span>
    <span class="toc-card-title">Sidebar</span>
  </a>
  <a href="#top-bar" class="toc-card">
    <span class="toc-card-icon">🔔</span>
    <span class="toc-card-title">Top bar</span>
  </a>
  <a href="#stats-bar" class="toc-card">
    <span class="toc-card-icon">📊</span>
    <span class="toc-card-title">Stats bar</span>
  </a>
  <a href="#search-filters-sort" class="toc-card">
    <span class="toc-card-icon">🔍</span>
    <span class="toc-card-title">Search, filters & sort</span>
  </a>
  <a href="#miner-card" class="toc-card">
    <span class="toc-card-icon">📇</span>
    <span class="toc-card-title">Miner card</span>
  </a>
  <a href="#miner-card-day-chart" class="toc-card">
    <span class="toc-card-icon">📈</span>
    <span class="toc-card-title">Card + chart</span>
  </a>
</div>

## ☰ Sidebar
{: #sidebar }

![Sidebar]({{ '/assets/images/sidebar-only.png' | relative_url }})

1. **AxeOS · D#hashboard** — app name, click to return home.
2. **Home** — overview of all your miners.
3. **Alerts** — alert history (temperature, fan, offline...).
   [Go to Alerts →]({{ '/en/alerts.html' | relative_url }}){: .btn .btn-primary }
4. **Configuration** — automatic detection, configured miners, remote.
   [Go to Configuration →]({{ '/en/configuration.html' | relative_url }}){: .btn .btn-primary }
5. **Auto-refresh** — toggles automatic data refresh.
6. **Version** — the currently deployed build's SHA.
7. **Update available** — only shows up if a newer dashboard version is
   available on GitHub; click to open the release.

---

## 🔔 Top bar
{: #top-bar }

![Top bar]({{ '/assets/images/topbar-only.png' | relative_url }})

1. **Refresh** — shows whether auto-refresh is on.
2. **Notifications** — event history (alert resolved, update
   available...).
3. **Language** — switch between French and English.

---

## 📊 Stats bar
{: #stats-bar }

![Stats bar]({{ '/assets/images/globalstats.png' | relative_url }})

1. **Total hashrate** — sum of the hashrate of all active miners.
2. **Shares (session)** — total shares accepted since the feeder
   started; below it, the lifetime total since the very first run, which
   survives a miner reboot.
3. **Temp · Fan** — temperature: the number on the **left** is the
   minimum, the one on the **right** the maximum, across all miners.
   Below it, the **peak** fan speed recorded.
4. **Miners** — number of configured miners, total power draw (W) and
   yearly estimate (kWh/yr).
5. **Elec. cost / day** — estimated daily electricity cost, based on the
   configured rate.

---

## 🔍 Search, filters & sort
{: #search-filters-sort }

A row below the totals lets you refine which cards are shown, with no
extra network calls:

![Search, filters and sort]({{ '/assets/images/actionbar.png' | relative_url }})

1. **Pool** — dropdown listing the pools currently in use (only shown
   when more than one is active), with each pool's miner count and
   combined hashrate.
2. **Sort** — 5 possible orders, remembered across visits: total uptime
   ascending (default), accepted shares, fastest fan, highest
   temperature, or pool name (A-Z).
3. **Filters** — opens/closes the panel below.
4. **Search** — free text (hostname, IP, model, pool, stratum user,
   firmware version) or comparisons: `temp>60`, `fan<=50`, `power>15`,
   `hashrate<0.3`, `uptime>3600` (seconds). Keyword `offline` (negate
   with `!offline`/`-offline`). Multiple terms separated by a space must
   all match; negate with `-`/`!`.
5. **Model** — quick filter by miner type, with a count for each.
6. **Alerts** — quick filter by condition (high temperature, high fan,
   offline), with a count for each.

---

## 📇 Miner card
{: #miner-card }

![Miner card]({{ '/assets/images/card-collapsed.png' | relative_url }})

1. **Name** — the miner's alias or hostname, preceded by a dot showing
   its status: green (reachable), red (unreachable), grey (first check
   pending), orange (config mismatch — see below).
2. **Timestamp** — date and time of the last data received.
3. **Model** — bitaxe or nerdaxe, with its hardware variant.
4. **IP address** — direct link to the miner's own interface.
5. **Hashrate** — current hash rate (TH/s) and best difficulty for the
   session.
6. **Shares** — number of accepted / rejected shares.
7. **Temperature · Fan** — chip temperature and fan speed.
8. **Power · Efficiency** — power draw (W) and efficiency (J/TH).
9. **Active pool** — pool in use, response time, Primary/Fallback badge.
   The chevron expands the detail: stratum user and the inactive pool.
   A ⧉ icon opens the pool's dashboard, when a link is configured for it
   (see [Configuration]({{ '/en/configuration.html#electricity-pools' | relative_url }})).
10. **Uptime · Firmware** — time since last restart (orange badge < 1h,
    grey 1-24h, green ≥ 24h), installed version and an orange badge if
    an update is available.
11. **Actions** — switch pool or restart the miner (confirmation
    required).
12. **History / Totals** — toggles between the day's chart and the
    lifetime totals since the first run.

{: .note }
> ⚠️ If a miner's configured `mac:` doesn't match what it actually
> reports (wrong device at that IP, or a typo), an orange banner appears
> under the card's header with the error detail (and a button to copy
> it), and the status dot turns orange.

---

## 📈 Miner card with day chart
{: #miner-card-day-chart }

![Miner card with day chart]({{ '/assets/images/card-day-graph.png' | relative_url }})

1. **Today's history** — tab to expand and show the chart.
2. **Metrics** — choice of data shown: temperature, fan, hashrate or
   ping.
3. **Period** — **1H** (last hour) or **Day** (hourly averages over the
   full day).
4. **Chart** — the chosen metric's trend over the selected period.
