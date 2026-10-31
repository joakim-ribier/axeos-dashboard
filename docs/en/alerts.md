---
title: Alerts
nav_order: 4
group: Pages
lang: en
subnav:
  - title: Alert types
    anchor: types
---

# Alerts

History of alerts detected by the feeder, one day at a time — today by
default, or any other day via the calendar. Available from the sidebar.

![Alerts page]({{ '/assets/images/alerts.png' | relative_url }})

An alert only shows up when its state changes: one row when it starts
(red, orange for a firmware update), one row when it ends (green), with
since when, how long it lasted and, for temperature and fan, the highest
reading reached (e.g. "10/28 2:18 PM → 10/28 4:28 PM · lasted 2h 10m ·
peak 99%"). Nothing in between: a temperature staying high for
hours takes two rows.

So that a reading hovering around a threshold doesn't raise an alert on
every poll, it clears under a lower threshold than the one that raised it
(see the table below). A miner is only reported offline after 2 missed
polls in a row.

The same changes of state feed the bell's notifications, and a mail on
every new alert when
[Configuration › Notifications]({{ '/en/configuration.html#notifications' | relative_url }})
turns it on.

Alerts **in progress** — started and not ended yet, however old — stay at
the top of the page, above the history of the day picked, with since when
they've lasted; for temperature and fan, the reading shown is the
miner's latest one, with the one at the start (e.g. "Atchoum fan speed
reached 99% · 10/26 2:18 PM · for 3j 2h 0m · 83% at the start"). Their count also
shows as a badge on the menu's Alerts entry: red as soon as one is a
problem, orange when only firmware updates are left, "9+" past 9. It only
goes down when an alert ends.

Filterable by miner, by type and by day (the alerts in progress follow
the miner and the type). Beside the day, **‹** and **›** step to the
previous or next day and **Today** goes back to it — on a phone, they stay
in sight with the filters folded. Each active filter shows up as a chip
below the bar: its cross removes it, **Clear all** removes them all.

## ⚠️ Alert types
{: #types }

The temperature and fan thresholds are set for every miner in
[Configuration › System]({{ '/en/configuration.html#system' | relative_url }}),
and for one miner in its row of Configuration › Miners.

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Raised</th>
      <th>Cleared</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>High temperature</td>
      <td>Chip above the threshold (62 °C by default)</td>
      <td>Chip 2 °C under the threshold</td>
    </tr>
    <tr>
      <td>High fan speed</td>
      <td>Speed above the threshold (75 % by default)</td>
      <td>Speed 5 % under the threshold</td>
    </tr>
    <tr>
      <td>Firmware update</td>
      <td>Miner's version behind the latest GitHub release</td>
      <td>Miner up to date</td>
    </tr>
    <tr>
      <td>Offline</td>
      <td>Miner unreachable for 2 polls in a row</td>
      <td>The miner answers again</td>
    </tr>
    <tr>
      <td>Configuration mismatch</td>
      <td>The configured <code>mac:</code> doesn't match what the miner reports</td>
      <td>The right device answers again</td>
    </tr>
  </tbody>
</table>
