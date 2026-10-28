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
how long it lasted. Nothing in between: a temperature staying high for
hours takes two rows.

So that a reading hovering around a threshold doesn't raise an alert on
every poll, it clears under a lower threshold than the one that raised it
(see the table below). A miner is only reported offline after 2 missed
polls in a row.

The same changes of state feed the bell's notifications.

Filterable by miner, by type and by day. Each active filter shows up as
a chip below the bar: its cross removes it, **Clear all** removes them
all.

## ⚠️ Alert types
{: #types }

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
      <td>Chip &gt; 62°C</td>
      <td>Chip &lt; 60°C</td>
    </tr>
    <tr>
      <td>High fan speed</td>
      <td>Speed &gt; 75%</td>
      <td>Speed &lt; 70%</td>
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
