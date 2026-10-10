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
  - title: The fleet
    anchor: fleet
  - title: Miner status & pools
    anchor: status-pools
  - title: Search, filters & sort
    anchor: search-filters-sort
  - title: The miner list
    anchor: list
  - title: A miner's details
    anchor: details
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
  <a href="#fleet" class="toc-card">
    <span class="toc-card-icon">📊</span>
    <span class="toc-card-title">The fleet</span>
  </a>
  <a href="#status-pools" class="toc-card">
    <span class="toc-card-icon">🚦</span>
    <span class="toc-card-title">Status & pools</span>
  </a>
  <a href="#search-filters-sort" class="toc-card">
    <span class="toc-card-icon">🔍</span>
    <span class="toc-card-title">Search, filters & sort</span>
  </a>
  <a href="#list" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-title">The list</span>
  </a>
  <a href="#details" class="toc-card">
    <span class="toc-card-icon">🔎</span>
    <span class="toc-card-title">Details</span>
  </a>
</div>

## ☰ Sidebar
{: #sidebar }

<div class="shot-aside" markdown="1">

![Sidebar]({{ '/assets/images/sidebar-only.png' | relative_url }}){: width="240" }

1. **AxeOS · D#hashboard** — reloads the app and goes back home, as when
   first arriving on the dashboard.
2. **Home** — overview of all your miners.
3. **Alerts** — alert history (temperature, fan, offline...).
   [Go to Alerts →]({{ '/en/alerts.html' | relative_url }}){: .btn .btn-primary }
4. **Settings** — automatic detection, configured miners, remote.
   [Go to Configuration →]({{ '/en/configuration.html' | relative_url }}){: .btn .btn-primary }
5. **Backups** — monthly archives of the miners' history, to download.
   [Go to Backups →]({{ '/en/backups.html' | relative_url }}){: .btn .btn-primary }
6. **Audit** — history of restarts, pool switches, configuration changes, exports and network scans.
   [Go to Audit →]({{ '/en/audit.html' | relative_url }}){: .btn .btn-primary }
7. **Auto-refresh** — toggles automatic data refresh.
8. **Version** — the currently deployed build's SHA.
9. **Update available** — only shows up if a newer dashboard version is
   available on GitHub; click to open the release.

</div>

On a phone, the sidebar opens from the top bar's ☰ button.

---

## 🔔 Top bar
{: #top-bar }

Always on screen, even while scrolling the page.

![Top bar]({{ '/assets/images/topbar-only.png' | relative_url }})

1. **Page** — the current page's icon, title and description.
2. **Documentation** — opens this documentation.
3. **Auto-refresh** — shows whether auto-refresh is on (blue) or off
   (grey).
4. **Notifications** — ongoing alerts and recent events (alert resolved,
   update available...); the red badge counts the unread ones.
5. **Language** — switches between French and English.

On a phone, the bar keeps what matters most:

![Top bar on a phone]({{ '/assets/images/topbar-mobile.png' | relative_url }}){: width="390" }

1. **Menu** — opens the sidebar.
2. **Page** — the current page's icon and title.
3. **Auto-refresh**
4. **Notifications**
5. **More** — unfolds the documentation and language below the bar;
   folds back on every page change.

---

## 📊 The fleet
{: #fleet }

![The fleet]({{ '/assets/images/fleet.png' | relative_url }})

1. **Fleet hashrate · 24 h** — what all the miners produce together.
2. **Health** — how many miners have no problem, out of the total. Takes
   the color of the most urgent problem, if any. A click unfolds every
   miner, the ones with a problem first, each with its status; clicking
   one opens [its details](#details).

   ![Every miner under the health badge]({{ '/assets/images/fleet-health.png' | relative_url }}){: width="328" }

3. **Last poll** — time of the most recent reading. Turns red when even
   that one is older than twice the configured polling interval: the
   feeder has stopped.
4. **Current hashrate** — the sum of the reachable miners' hashrate, and
   next to it the average over the last 24 h.
5. **24 h chart** — the fleet's combined hashrate, in 15-minute steps. A
   stretch with no reading at all (feeder stopped) shows in grey.
6. **Power** — the reachable miners' total draw; below, the lowest ↓ and
   highest ↑ of a single miner.
7. **Efficiency** — the fleet's efficiency (J/TH); below, the best ↓ and
   worst ↑ miner.
8. **Electricity** — estimated cost over a day at the current draw and
   the configured rate, for the whole setup: the miners plus the
   [other devices]({{ '/en/configuration.html#electricity-pools' | relative_url }})
   declared (fan, router...). Below, the total actually spent since each
   miner started being tracked — a later rate change never alters that
   past total.
9. **Shares** — total accepted shares since the miners last started;
   below, the cumulative total since they were first set up.
10. **Best diff** — the best difficulty reached, and the miner holding it.
11. **Temperature** — the lowest ↓ and highest ↑ chip temperature; below,
    the fastest fan speed.

---

## 🚦 Miner status & pools
{: #status-pools }

![Miner status and pools]({{ '/assets/images/breakdowns.png' | relative_url }})

1. **Miner status** — the miners broken down by status, most urgent
   first:
   - **Offline** — the miner no longer answers.
   - **Config error** — the configured `mac:` doesn't match what the miner
     reports (wrong device at that IP, or a typo).
   - **Delayed** — the miner answers, but no reading has come in for more
     than twice the polling interval.
   - **Alert** — chip temperature at 62 °C or more, or fan at 75 % or
     more.
   - **Online** — all good.
2. **Pools** — the share of the fleet's hashrate going to each pool.

Each chip filters the miner list below; a second click removes the
filter.

---

## 🔍 Search, filters & sort
{: #search-filters-sort }

![Search, filters and sort]({{ '/assets/images/toolbar.png' | relative_url }})

1. **Search** — free text (name, IP, model, pool, stratum user, firmware
   version) or comparisons: `temp>60`, `fan<=50`, `power>15`,
   `hashrate<0.3`, `uptime>3600` (seconds). `offline` keyword (negate with
   `!offline`/`-offline`). Several space-separated terms must all match;
   negate any term with `-`/`!`.
2. **Tips** — a reminder of that syntax.
3. **Sort** — hottest (default), hashrate, fastest fan, most shares,
   oldest (total uptime) or pool (A-Z), remembered between visits.
   Whatever the sort, miners with a problem stay on top, most urgent
   first.
4. **Model** — filter by miner type, with the number of miners for each.
5. **Firmware** — filter by firmware version, with the number of miners
   for each.
6. **View** — list or tiles, remembered between visits. On a phone,
   miners always show as tiles.
7. **Counter** — how many miners are shown, out of the total.

---

## 📋 The miner list
{: #list }

![The miner list]({{ '/assets/images/miner-list.png' | relative_url }})

1. **Miner** — alias or hostname, then its IP and model.
2. **Hashrate · 24 h** — the last 24 h of hashrate and its current value.
   Stretches where the miner was unreachable show in red on the baseline.
3. **Chip temp** — chip temperature, on a green gauge that turns orange
   close to the 62 °C threshold (marked by a tick), then red once it's
   reached.
4. **Fan** — fan speed, on the same gauge, with a 75 % threshold.
5. **Power** — draw (W) and efficiency (J/TH).
6. **Pool** — the active pool, linking to its dashboard when a link is
   known for it (see
   [Configuration]({{ '/en/configuration.html#electricity-pools' | relative_url }})),
   and whether it's the **Primary** or **Fallback** one.
7. **Firmware** — installed version; below, in blue, the newer version
   available if there is one.
8. **Status** — the stripe on the left takes the color of
   [the miner's status](#status-pools).
9. **Details** — a click anywhere on the row opens
   [the miner's details](#details).

As tiles, each miner shows the same information, with its status spelled
out:

![Miners as tiles]({{ '/assets/images/miner-tiles.png' | relative_url }}){: width="580" }

---

## 🔎 A miner's details
{: #details }

A panel that slides in from the right (full screen on a phone); it closes
with the cross, by clicking next to it, or with a swipe to the right on a
phone.

<div class="shot-aside" markdown="1">

![A miner's details]({{ '/assets/images/drawer.png' | relative_url }}){: width="340" }

1. **Name and status** — the stripe at the top takes the status color.
2. **IP** — a direct link to the miner's own interface, followed by its
   model.
3. **Readings** — the last 24 h of hashrate, power and efficiency, chip
   temperature and fan with their threshold.
4. **Last 24 hours** — a chart of the temperature, fan, hashrate or ping,
   over the last hour (**1H**) or the last 24 hours (**24H**).
5. **Pools** — the primary and fallback pools, the active one marked
   **Active**; each links to its dashboard when a link is known for it.
6. **User** — the selected pool's stratum user, copied in one click.
   Clicking the other pool shows its own.
7. **Session** — accepted and rejected shares, best difficulty and uptime
   since the last restart.
8. **Since tracking began** — accepted shares, uptime and electricity
   spent since the miner was first set up.
9. **Device** — firmware version, MAC address, pool ping and time of the
   last poll.
10. **Actions** — **Restart** the miner or **Switch** to the other pool
    (the miner restarts to apply it), always after a confirmation.

</div>

When the miner has a problem, a banner right under the header details
it: unreachable, no reading since a given time, configuration error,
temperature or fan at its threshold. A newer firmware version shows in a
blue banner, with a link to its release.
