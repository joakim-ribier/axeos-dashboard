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

Rather than one row per poll — an alert lasting hours would otherwise
create dozens of near-identical rows — consecutive occurrences of the
same alert type on the same miner are grouped into a single **episode**:
first seen, last seen, and occurrence count (above, "61 occurrences" for
the firmware update alerts running since the start of the day). An alert
that only shows up once is displayed with no time range or count (e.g.
"Atchoum: fan at 76%" above).

An episode ends once the alert has been gone longer than the feeder's
polling interval — under that delay, a new occurrence extends the same
episode instead of starting a new one.

Filterable by miner and by type (dropdowns), with a button to reset the
filters.

## ⚠️ Alert types
{: #types }

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Trigger</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>High temperature</td>
      <td>Chip &gt; 62°C</td>
    </tr>
    <tr>
      <td>High fan</td>
      <td>Speed &gt; 75%</td>
    </tr>
    <tr>
      <td>Firmware update</td>
      <td>Miner's firmware behind the latest GitHub release</td>
    </tr>
    <tr>
      <td>Offline</td>
      <td>Miner unreachable</td>
    </tr>
    <tr>
      <td>Config mismatch</td>
      <td>The configured <code>mac:</code> doesn't match what the miner reports</td>
    </tr>
  </tbody>
</table>
