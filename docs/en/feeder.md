---
title: Feeder
nav_order: 6.7
group: Services
lang: en
subnav:
  - title: Its role
    anchor: role
  - title: Each cycle
    anchor: cycle
  - title: Files written
    anchor: files
  - title: Push to hashboard
    anchor: hashboard
  - title: Firmware
    anchor: firmware-update-detection
  - title: Backups
    anchor: backups
  - title: Logs and shutdown
    anchor: logs
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#role" class="toc-card">
    <span class="toc-card-icon">🎯</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Its role</span>
      <span class="toc-card-sub">Poll, store, alert</span>
    </span>
  </a>
  <a href="#cycle" class="toc-card">
    <span class="toc-card-icon">🔁</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Each cycle</span>
      <span class="toc-card-sub">Step by step</span>
    </span>
  </a>
  <a href="#files" class="toc-card">
    <span class="toc-card-icon">🗂️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Files written</span>
      <span class="toc-card-sub">The history on disk</span>
    </span>
  </a>
  <a href="#hashboard" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Push to hashboard</span>
      <span class="toc-card-sub">What goes out, and when</span>
    </span>
  </a>
  <a href="#firmware-update-detection" class="toc-card">
    <span class="toc-card-icon">⬆️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Firmware</span>
      <span class="toc-card-sub">Each model's latest version</span>
    </span>
  </a>
  <a href="#backups" class="toc-card">
    <span class="toc-card-icon">📦</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Backups</span>
      <span class="toc-card-sub">Each month's archive</span>
    </span>
  </a>
  <a href="#logs" class="toc-card">
    <span class="toc-card-icon">📜</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Logs and shutdown</span>
      <span class="toc-card-sub">Where it writes, how it stops</span>
    </span>
  </a>
</div>

The service polling your miners at a regular interval and writing their
history to disk, where the dashboard reads it.

## 🎯 Its role
{: #role }

The only service collecting the miners' data. It runs all the time, next to
dashboard-api and the mailer:

- Poll — each enabled miner, on every cycle.
- Store — each poll in the day's history, with each miner's last poll and
  totals.
- Track the alerts — temperature, fan, firmware, offline, different MAC:
  each one written when it starts and when it ends.
- Push to hashboard — the stats, when sending is set up.
- Check the firmware — each model's latest release.
- Back up — each completed day, into its month's archive.

dashboard-api reads these files for the home screen, the alerts and the
charts; it's the one doing the actions on the miners.

---

## 🔁 Each cycle, step by step
{: #cycle }

A cycle runs at startup, then every `feeder.interval` of `dashboard.yml`
(2 minutes in the example configuration).

1. Read the configuration again — `miners.yml` and `settings.yml`, when they
   changed: a miner added, a rate changed in Configuration apply from this
   cycle on.
2. For each enabled miner, in `miners.yml`'s order:
   1. Check its MAC — with no `mac`, the miner is skipped (an error in the
      logs): its history is stored under its MAC.
   2. Poll it — `GET /api/system/info` at its IP, with the
      `endpoints.timeout` delay (5 s by default).
   3. If it doesn't answer — an "offline" line in the day's history
      (`latest.json` keeps the last poll), also sent to hashboard; on the
      2nd missed poll in a row, the "offline" alert starts.
   4. If its MAC isn't the configured one (another device at this IP, or a
      typo) — the poll is refused, and the "different MAC" alert starts.
   5. Track the alerts — compared with the previous poll: only those
      starting or ending are written. The temperature and the fan follow the
      miner's thresholds, the firmware its model's latest release.
   6. Store — the poll's line (readings, kWh rate) in the day's history;
      `latest.json` is replaced, and `totals.json` adds up the uptime, the
      shares and the electricity cost.
   7. Push to hashboard — the poll and the totals, when sending is set up.
3. Hand the new alerts to the mailer — all of the cycle's, in one call, when
   the alerts mail is on; the cycle doesn't wait for it.
4. Check the firmware — for each configured model, when the cached latest
   release is older than `firmware.cacheTTL`.

A disabled miner is no longer polled; its history stays on disk. The alerts
in progress are kept from one cycle, and one restart, to the next.
[Alerts]({{ '/en/alerts.html' | relative_url }}){: .link-page }

---

## 🗂️ Files written
{: #files }

Everything is stored under `dashboard.yml`'s `storage.dataDir`:

```text
{dataDir}/data/bitaxes/
  aabbccddeeff/              ← one folder per miner, named by its MAC
    2026-10-18.jsonl         ← the day's history (UTC), one line per cycle
    latest.json              ← the last successful poll
    totals.json              ← the totals since tracking began
    alerts.json              ← its alerts in progress
  firmware_cache.json        ← each model's latest known release
{dataDir}/data/backups/      ← the monthly archives
{dataDir}/data/audit/        ← the audit, where the feeder writes its backups
{dataDir}/data/alerts/       ← the alerts, one file per day (UTC)
```

- Day's history — one file per UTC day, only ever appended to. Each line has
  the time, the miner's raw answer and the kWh rate; an "offline" line, the
  time and its alert.
- Last poll — what the home screen shows for each miner.
- Alerts — one line per alert starting or ending: the Alerts page and the
  bell.
- Totals — uptime, shares, electricity cost. They go on when the miner
  restarts and when the rate changes: each poll counts at its own time's
  rate.

A miner's folder comes from its MAC: a miner changing IP keeps its history.
[Scripts › rebuild-totals]({{ '/en/rebuild-totals.html' | relative_url }}){: .link-page }

---

## ☁️ Push to hashboard
{: #hashboard }

When the push URL and the API key are set (Configuration › Remote), the
feeder sends, on every cycle, for each miner:

- the poll (`…/api/push`) — the readings, the name, the model, the rate, the
  latest firmware release and the feeder's interval; the wallet, the pools
  and the IP hidden, unless you choose to share them;
- the totals (`…/api/push/totals`);
- an "offline" line (`…/api/push/history`) when the miner doesn't answer:
  the board's 24 h chart drops to 0, like locally.

Only what's sent is hidden: the local poll stays complete. The sends go out
in the background, with a 10 s timeout: a slow hashboard doesn't hold up the
cycle, and a failure is written to the logs.

On every cycle, the feeder also reads your board's miner limit: beyond it,
only the first enabled miners, in the configuration's order, are sent.
[Hashboard]({{ '/en/hashboard.html' | relative_url }}){: .link-page }

---

## ⬆️ Firmware update detection
{: #firmware-update-detection }

The feeder asks GitHub for each configured model's latest release, once per
`firmware.cacheTTL` (24 h by default), and keeps it in
`{dataDir}/data/bitaxes/firmware_cache.json`. Each miner in the API carries:

```json
{
  "version": "v2.4.0",
  "latestVersion": "v2.5.1",
  "updateAvailable": true
}
```

`updateAvailable` is `true` when a newer version exists: the miners' list
and their detail show it.
[The miners' list]({{ '/en/dashboard.html#list' | relative_url }}){: .link-page }

---

## 📦 Monthly backups
{: #backups }

Every hour, the feeder adds each completed day (UTC) not yet archived to its
month's archive, `{dataDir}/data/backups/YYYY-MM.zip` — in practice the day
before, just after midnight UTC. The archive is replaced only once fully
written. A completed month has its MD5 in `checksums.md5`: its archive no
longer changes. All of this runs next to the polls, without holding them up;
a backup that archives at least one day, or that fails, is written to the
audit (type `backup`).
[Backups]({{ '/en/backups.html' | relative_url }}){: .link-page }

---

## 📜 Logs and shutdown
{: #logs }

- Logs — in `{dataDir}/logs/feeder.log` (one JSON line per event), or on the
  console when `global.env` is `dev`: each cycle, each miner error, each
  failed send and each backup.
- Shutdown — cleanly, on `SIGINT` / `SIGTERM`.
- At startup — an enabled miner without a `mac` is reported in the logs.

{% include page_nav.html position="bottom" %}
