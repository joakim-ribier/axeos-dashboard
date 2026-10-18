---
title: Feeder
nav_order: 9
group: Dev
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

# Feeder

<div class="toc-grid">
  <a href="#role" class="toc-card">
    <span class="toc-card-icon">🎯</span>
    <span class="toc-card-title">Its role</span>
  </a>
  <a href="#cycle" class="toc-card">
    <span class="toc-card-icon">🔁</span>
    <span class="toc-card-title">Each cycle</span>
  </a>
  <a href="#files" class="toc-card">
    <span class="toc-card-icon">🗂️</span>
    <span class="toc-card-title">Files written</span>
  </a>
  <a href="#hashboard" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-title">Push to hashboard</span>
  </a>
  <a href="#firmware-update-detection" class="toc-card">
    <span class="toc-card-icon">⬆️</span>
    <span class="toc-card-title">Firmware</span>
  </a>
  <a href="#backups" class="toc-card">
    <span class="toc-card-icon">📦</span>
    <span class="toc-card-title">Backups</span>
  </a>
  <a href="#logs" class="toc-card">
    <span class="toc-card-icon">📜</span>
    <span class="toc-card-title">Logs and shutdown</span>
  </a>
</div>

The service that polls the miners at a regular interval and writes their
history to disk, where the dashboard reads it from.

## Its role
{: #role }

The feeder is the one service that collects the miners' data. It runs
continuously, alongside dashboard-api and the mailer, and does just
that:

- **collect** — every enabled miner is polled on each cycle;
- **store** — each reading is added to the day's history, and each
  miner's latest reading and totals are updated;
- **compute the alerts** — temperature, fan, firmware, miner offline,
  MAC address mismatch;
- **push to hashboard** — the miners' stats, when remote access is set
  up;
- **check the firmware** — each model's latest release;
- **back up** — each completed day's history, into its month's archive.

dashboard-api then reads these files for the home screen, the alerts
and the charts. Actions on the miners (restart, pool switch) go through
dashboard-api.

## Each cycle, step by step
{: #cycle }

A cycle runs at startup, then every `feeder.interval` (2 minutes by
default, in `dashboard.yml`).

1. **Re-read the configuration** — `miners.yml` and `settings.yml` are
   re-read if they changed: a miner added, a rate or remote access
   changed from the Settings page apply from this cycle on, no restart
   needed.
2. **For each enabled miner**, in `miners.yml` order:
   1. **Check its MAC** — a miner with no `mac` is skipped (an error in
      the logs): its history is stored under its MAC.
   2. **Poll it** — `GET /api/system/info` at its IP, with the
      `endpoints.timeout` delay (5 s by default).
   3. **If it doesn't answer** — an "offline" line is added to the day's
      history (`latest.json` keeps the last known reading), then pushed
      to hashboard. On to the next miner.
   4. **If the MAC it reports isn't the configured one** (another device
      at this IP, or a typo) — the reading is refused: only a "MAC
      mismatch" alert line is added to the day's history. On to the next
      miner.
   5. **Compute the reading's alerts** — chip temperature above 62 °C,
      fan above 75 %, firmware other than the latest release known for
      its model.
   6. **Store** — the reading's line (measurements, the kWh rate in
      effect, alerts) is added to the day's history, `latest.json` is
      replaced, and `totals.json` adds up the uptime, the accepted and
      rejected shares and the electricity cost since the previous reading.
   7. **Push to hashboard** — the reading and the totals, if remote
      access is set up.
3. **Check the firmware** — once per model present in the
   configuration, the latest release is fetched if the cached one is
   older than `firmware.cacheTTL`.

A disabled miner isn't polled: its history stays on disk, with no new
lines.

The alerts are computed again on each reading, from that reading alone.
The dashboard then groups the successive readings of a same alert into
episodes.

[Go to Alerts →]({{ '/en/alerts.html' | relative_url }}){: .btn .btn-primary }

## Files written
{: #files }

Everything lives under `dashboard.yml`'s `storage.dataDir`:

```
{dataDir}/data/bitaxes/
  aabbccddeeff/              ← one folder per miner, named after its MAC
    2026-10-18.jsonl         ← the day's (UTC) history, one line per cycle
    latest.json              ← the latest successful reading, replaced every cycle
    totals.json              ← the totals since tracking began
  firmware_cache.json        ← each model's latest known release
{dataDir}/data/backups/      ← the monthly archives, see Backups
{dataDir}/data/audit/        ← the audit, where the feeder records its backups
```

- **The day's history** (`YYYY-MM-DD.jsonl`) — one file per UTC day,
  never rewritten, only appended to. Each line carries the time (UTC),
  the miner's raw response, the kWh rate in effect and the computed
  alerts. An "offline" or "MAC mismatch" line only has the time and its
  alert.
- **Latest reading** (`latest.json`) — the latest successful line; it's
  what the home screen shows for each miner.
- **Totals** (`totals.json`) — uptime, accepted and rejected shares,
  electricity cost. They keep growing when the miner restarts (its own
  counters then start over from zero) and when the rate changes (each
  reading counts at the rate of its time).

Each miner's folder is named after its MAC, not its IP: a miner whose IP
changes keeps its history.

[Go to Rebuild the totals →]({{ '/en/rebuild-totals.html' | relative_url }}){: .btn .btn-primary }

## Push to hashboard
{: #hashboard }

Once the push URL and API key are set (Settings › Remote), the feeder
pushes to hashboard, on each cycle and for each miner:

- **the reading** — to `…/api/push`: the measurements, the name (or
  alias), the model, the kWh rate, the firmware's latest release and the
  feeder's interval;
- **the totals** — to `…/api/push/totals`;
- **an "offline" line** — to `…/api/push/history`, when the miner
  doesn't answer: the board's 24h chart dips to 0 as it does locally.

Each miner is stored on hashboard under the same folder name as locally.
Pushes run in the background, with a 10 s delay: a slow or unreachable
hashboard never delays the cycle, the failure is written to the logs.

[Go to Remote →]({{ '/en/configuration.html#remote' | relative_url }}){: .btn .btn-primary }

## Firmware update detection
{: #firmware-update-detection }

The feeder checks GitHub for the latest release once per
`firmware.cacheTTL` (24h by default) and per miner model present in the
configuration. The result is cached in
`{dataDir}/data/bitaxes/firmware_cache.json`.

Each miner in the API response includes:

```json
{
  "version": "v2.4.0",
  "latestVersion": "v2.5.1",
  "updateAvailable": true
}
```

`updateAvailable` is `false` on the very first startup (before the
feeder has completed a cycle) or when the firmware is already up to
date — this is what shows the newer version available in the miner list
and in a miner's details.

[Go to The miner list →]({{ '/en/dashboard.html#list' | relative_url }}){: .btn .btn-primary }

## Monthly backups
{: #backups }

Every hour, the feeder adds each completed (UTC) day not yet archived to
its month's archive, `{dataDir}/data/backups/YYYY-MM.zip` — in
practice, the previous day, right after midnight UTC. Days already
archived are copied over as-is without being recompressed, and the
archive is only replaced once fully written. Once a month is over, its
archive's MD5 is recorded in `checksums.md5`: the archive is then final
and never opened again. All of this runs alongside polling, without ever
delaying it.

Each backup that adds a day or completes a month, or that fails, shows
up in the audit (type `backup`).

[Go to Backups →]({{ '/en/backups.html' | relative_url }}){: .btn .btn-primary }

## Logs and shutdown
{: #logs }

- **Logs** — in `{dataDir}/logs/feeder.log` (one JSON line per event), or
  in the console when `global.env` is `dev`. Every cycle, every miner
  error, every failed push and every backup is written there.
- **Shutdown** — the feeder stops cleanly on `SIGINT` / `SIGTERM`.
- **At startup** — an enabled miner with no `mac` is reported in the
  logs.
