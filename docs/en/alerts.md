---
title: Alerts
nav_order: 4
group: Pages
lang: en
subnav:
  - title: The page
    anchor: page
  - title: In progress
    anchor: ongoing
  - title: Alert types
    anchor: types
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#page" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-text">
      <span class="toc-card-title">The page</span>
      <span class="toc-card-sub">The filters and a day's alerts</span>
    </span>
  </a>
  <a href="#ongoing" class="toc-card">
    <span class="toc-card-icon">🔴</span>
    <span class="toc-card-text">
      <span class="toc-card-title">In progress</span>
      <span class="toc-card-sub">What still lasts, and the menu's badge</span>
    </span>
  </a>
  <a href="#types" class="toc-card">
    <span class="toc-card-icon">⚠️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Alert types</span>
      <span class="toc-card-sub">When each starts and ends</span>
    </span>
  </a>
</div>

Your miners' alerts: those in progress, and a day's history.

## 📋 The page
{: #page }

![Alerts page]({{ '/assets/images/alerts.png' | relative_url }}){: width="723" }

1. Miner — one miner, or all of them.
2. Type — one alert type, or all of them.
3. Day — the day shown, today by default.
4. ‹ Today › — the day before, the day after, or back to today; always there
   on a phone, the filters folded.
5. Active filters — one per chip: its cross removes it, *Clear all* removes
   them all.
6. An alert that starts — in red (orange for a firmware update), with the
   value and the time.
7. An alert that ends — in green, with its start, its duration and the
   highest value reached.

An alert takes two lines, its start and its end, even if it lasts for hours.
Each one also reaches the bell's notifications, and a mail if you turn it on.
[Configuration › Notifications]({{ '/en/configuration.html#notifications' | relative_url }}){: .link-page }

---

## 🔴 In progress
{: #ongoing }

The alerts not over yet stay at the top of the page, above the history,
whatever day they started. They follow the miner and type filters. For the
temperature and the fan, the value shown is the latest poll's, with the
starting one and the value the alert ends under.

Their count shows as a badge on *Alerts* in the menu: red as soon as one is
a problem, orange when only firmware updates are left.

---

## ⚠️ Alert types
{: #types }

So that a value hovering around its threshold stays one alert, the
temperature and the fan go back to normal under their threshold minus a
margin. A miner goes offline after 2 missed polls in a row.

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Starts</th>
      <th>Ends</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Temperature</td>
      <td>Chip above the threshold (62 °C by default)</td>
      <td>Under the threshold minus the margin (2 °C by default)</td>
    </tr>
    <tr>
      <td>Fan</td>
      <td>Speed above the threshold (75 % by default)</td>
      <td>Under the threshold minus the margin (5 % by default)</td>
    </tr>
    <tr>
      <td>Firmware update</td>
      <td>A newer version is out on GitHub</td>
      <td>The miner is up to date</td>
    </tr>
    <tr>
      <td>Offline</td>
      <td>No answer to 2 polls in a row</td>
      <td>The miner answers again</td>
    </tr>
    <tr>
      <td>Configuration error</td>
      <td>The configured MAC isn't the miner's</td>
      <td>The right device answers again</td>
    </tr>
  </tbody>
</table>

The thresholds are set for all your miners, or for one in its panel; the
margins, common to every miner, in the same place.
[Configuration › System]({{ '/en/configuration.html#system' | relative_url }}){: .link-page }

{% include page_nav.html position="bottom" %}
