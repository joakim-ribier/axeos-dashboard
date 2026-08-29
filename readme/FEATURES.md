# Features

See the main [README](../README.md) for architecture and quick start — this
doc details what the dashboard actually does, screen by screen.

- [Dashboard Features](#dashboard-features)
  - [Top bar & sidebar](#top-bar--sidebar)
  - [Search & filters](#search--filters)
  - [Alerts](#alerts)
  - [Global stats bar](#global-stats-bar)
  - [Miner card](#miner-card)
  - [Settings (`/settings`)](#settings-settings)
  - [Remote mode (`/{boardId}`)](#remote-mode-boardid)
- [Persistent Totals](#persistent-totals)
- [Firmware Update Detection](#firmware-update-detection)

---

## Dashboard Features

### Top bar & sidebar

- **Notifications** — bell icon with an unread-count badge; opens a list of every currently *active* alert, alongside dashboard app updates, with a **Clear** button. A *resolution* is also shown once it clears for `tempHigh`/`fanHigh`/`firmwareUpdate` (temp/fan back to normal, firmware updated) — but deliberately not for `offline`/`macMismatch`: those are detected live by a much faster, unpersisted watcher than what the feeder polls and records, so a short blip can clear without ever being written to history, making a "resolved" notification for them unreliable enough to just not show (see [Alerts](#alerts) below)
- **Auto-refresh** — toggle switch in the sidebar; the top bar shows a small read-only icon for its current state
- **Language** — EN / FR switcher
- **App version** — this dashboard-api/remote-dashboard-api build's git SHA, plus "Up to date" or a clickable "Update available" chip linking to the GitHub release (checked server-side once a day — about the dashboard app itself, not miner firmware)
- **Remote mode only** — a board ID chip with a public/private badge, and a link to manage the board from your hashboard account

### Search & filters

Toggle the filters panel from the funnel icon in the page header.

- Plain text matches hostname, IP, model, pool, stratum user, firmware version
- Comparisons: `temp>60`, `fan<=50`, `power>15`, `hashrate<0.3`, `uptime>3600` (seconds)
- Keyword `offline` (negate with `!offline` / `-offline`)
- Negate any term with `-` / `!`; combine multiple terms with a space — all must match
- Quick-filter chips for pool, device model, and alerts (high temp / high fan / offline), each showing a live count

### Alerts

Alerts are computed server-side by the feeder on every poll — level-triggered
(present for as long as the condition holds, recomputed fresh each tick, no
memory of the previous poll) — and persisted alongside that miner's history:

| Type | Trigger | Source |
|------|---------|--------|
| `tempHigh` | Chip temperature > 62°C (fixed threshold, not yet user-configurable) | Feeder, every poll |
| `fanHigh` | Fan speed > 75% (fixed threshold, not yet user-configurable) | Feeder, every poll |
| `firmwareUpdate` | Device firmware behind the cached latest GitHub release | Feeder, every poll |
| `offline` | Miner unreachable | Independent healthcheck watcher (live only, not persisted) **and** the feeder's own poll, if it also happens to fail |
| `macMismatch` | Configured `mac:` doesn't match what the device itself reports | Same dual source as `offline` |

`tempHigh`/`fanHigh`/`firmwareUpdate` have one consistent source (the
feeder), so both the bell and the history below are fully reliable for
them. `offline`/`macMismatch` are detected live by a healthcheck watcher
running far more often than the feeder polls, but that watcher never writes
to disk — only the feeder's own (much coarser) poll does. A blip shorter
than one feeder poll cycle can clear without ever being recorded, which is
exactly why the bell doesn't attempt a "resolved" notification for these
two (see [Top bar & sidebar](#top-bar--sidebar) above) and why their history
below can under-report short blips.

For a deeper look, **Alerts** (`/alerts` in the sidebar) lists every alert
recorded on one day at a time — today by default (fast: reads a single
small file per miner regardless of how long the deployment has been
running), or any other day via the calendar picker. Consecutive
occurrences of the same type on the same miner are grouped server-side
into one **episode** (`firstSeen`/`lastSeen`/`occurrences`/peak value)
instead of one row per poll, so a condition that holds for hours doesn't
bury the page under dozens of near-identical rows — a gap counts as the
same episode as long as it's under `3 × feeder.interval` (room for one
missed poll plus network/processing jitter). 50 episodes per page, most
recently active first, filterable by miner and type, with a "shown of
total" count (scoped to that day) and a reset-filters button. The
underlying API enforces the day scope: `date` is a required query param
on `/api/miners/alerts/history`, not optional. This page doesn't poll on a
timer even with auto-refresh on — it only refetches when opened or when a
filter/page changes.

In remote mode, the same page is available per board at `/{boardId}/alerts`,
read-only, sourced from whatever the feeder last pushed to hashboard. A
single hashboard.live deployment can be receiving pushes from many
different axeos-dashboard installations, each with its own
`feeder.interval`, so remote-dashboard-api has no single interval of its
own to assume — it reads the source feeder's actual interval back out of
whatever's already been pushed for that board (every pushed sample carries
it, the same way it already carries `electricityRatePerKwh`) and derives
the same `3 ×` threshold from that. It falls back to a fixed 10 minutes
only for a board with no miners yet, or one pushed by an axeos-dashboard
version old enough to predate this field.

### Global stats bar

| KPI | Description |
|-----|-------------|
| Total hashrate | Sum across all miners (TH/s), with trend arrow vs previous poll |
| Total shares | Accepted shares across all miners, with trend, plus the persistent lifetime total (survives reboots — see [Persistent Totals](#persistent-totals)) as a sub-value |
| Temp / Fan | Chip temperature range · max fan speed |
| Miners + power | Miner count · total watts · estimated annual kWh |
| Elec. cost / day | Estimated daily cost (€) based on `electricity.ratePerKwh` · monthly estimate |

### Miner card

**Header**

- Hostname (or IP as clickable link → opens device web UI)
- Device model chip + IP link (when hostname is set)
- Last poll timestamp
- Health dot: green (alive) · red (unreachable) · grey (first check pending) · orange (config error — see below)

**Hashrate row** — large TH/s value with trend

**Shares / Temp / Fan row**

```
✓ 1842  ✗ 3  |  52°C  65%
```

**Pool section**

- Active pool hostname (truncated, full URL on hover)
- Primary / Fallback badge
- Clickable dashboard link (⧉) when `pools.dashboards` has a matching entry
- Expand for stratum user + inactive pool

**Footer badges**

| Badge | Color | Meaning |
|-------|-------|---------|
| Uptime | Orange | < 1 hour |
| Uptime | Grey | 1–24 hours |
| Uptime | Green | ≥ 24 hours |
| `vX.Y.Z` | Orange | Firmware update available |

**Actions** — Switch pool · Restart (both require confirmation dialog)

**Today's History chart** (lazy-loaded)

Toggle **1H** (last hour relative to latest data point) or **Day** (hourly averages).
Fields: Temp (°C) · Fan (%) · Hashrate (TH/s) · Ping (ms).

**Totals tab** — next to "Today's History", shows each miner's persistent
lifetime totals (uptime + shares accepted) that survive device reboots — see
[Persistent Totals](#persistent-totals) for how they're computed.

**Config-mismatch banner** — if a miner's configured `mac:` doesn't match what
the device itself reports (wrong device at that IP, or a config typo), an
amber banner appears under the card's header with the error and a
copy-to-clipboard button, and the health dot turns orange. See the `mac:`
mismatch check in [Configuration](CONFIGURATION.md).

### Settings (`/settings`)

Local mode only — manages the managed `miners.yml` file (see
[Configuration](CONFIGURATION.md)). Three sections:

- **Configured miners** — every miner currently in `miners.yml`, including
  disabled ones, with enable/disable and a **disable all** button. Clicking
  a row expands it in place to reveal that miner's **pool scheduler**
  (below) without navigating away.
- **Automatic detection** — scans the local network (or a given CIDR) for
  AxeOS devices and lists what it finds, ready to select and save.
- **Add by IP** — probes one address directly, for a device the scan can't
  reach (different subnet, firewall).

**Pool scheduler** — per miner, add or remove cron-based automatic pool
switches (e.g. "switch to fallback every Friday at 23:59:59, back to
primary every Sunday"):

- The cron expression is a raw 6-field string, **seconds included**
  (`sec min hour dayOfMonth month dayOfWeek`) — as you type, a live,
  fully client-side translation shows what it means in plain language plus
  the next few times it would fire, and anything that doesn't parse is
  rejected before it can be submitted.
- A schedule that duplicates one already configured for that miner (same
  expression, regardless of spacing/case or target) is rejected too — both
  would otherwise fire at the exact same moment.
- A small badge next to a miner's name shows how many schedules it has
  without needing to expand the row.
- Every add/remove saves immediately, the same way the rest of this page
  does — and the running `dashboard-api` picks up the change and
  reschedules its cron jobs on its own within one `healthCheck.interval`
  tick, no restart needed.

### Remote mode (`/{boardId}`)

- **Private board** — visitors see a "this board is private" page with an
  email field to request access (handled by hashboard.live, the cloud
  service axeos-dashboard pushes data to for remote viewing)
- **Unknown or empty board** — a "page not found" message

---

## Persistent Totals

Live values like `uptimeSeconds`, `sharesAccepted`, and `sharesRejected` are
raw counters reported by the device itself — they reset to ~0 whenever the
miner reboots. Alongside them, the dashboard tracks a **persistent total**
per miner (total uptime, total shares accepted, total shares rejected) that
keeps growing across reboots instead of resetting. The Totals tab in the
miner card currently only surfaces uptime and accepted shares; the rejected
total is computed and available via the API but not yet shown in that tab.

**How it works** — on every feeder poll, `internal/storage.ApplyPoll`
compares the device's current raw counter to the last value it saw. If it
went up, the delta is added to the running total. If it went *down* (the
device rebooted and its own counter reset), the new value is added directly
instead of a negative delta, so the reboot never loses progress. The result
is written to `{dataDir}/data/bitaxes/{mac}/totals.json`, next to `latest.json` — a small
JSON file, independent of the day-by-day `.jsonl` history.

**Backfilling history** — `totals.json` only starts accumulating from
whenever this feature was first deployed. To reconstruct it from a miner's
*entire* JSONL history (replaying the same delta/reset logic from day one),
use the `rebuild-totals` tool:

```bash
make build
make rebuild-totals                             # dry-run, every configured miner
make rebuild-totals MINER=aabbccddeeff          # dry-run, one miner (mac, hostname, or ip)
make rebuild-totals DRY_RUN=                    # write it for real, every miner
```

Safe by design:
- **Dry-run by default**, both at the Makefile level and in the binary itself — `-dry-run` defaults to `true`; you must pass `-dry-run=false` explicitly to write anything.
- **Backs up before overwriting** — an existing `totals.json` is copied to `totals.json.bak` first.
- **Atomic writes** (temp file + rename) — a crash mid-write can never leave a corrupted `totals.json` behind.
- **Config-driven, not filesystem-driven** — only miners present in your `dashboard.yml`/`miners.yml` are processed, so a stray leftover directory under `{dataDir}/data/bitaxes` is never picked up silently.
- Read-only on `.jsonl`/`latest.json` — the only file it ever writes is `totals.json`.

**Remote mode** — when `remote.pushURL`/`remote.apiKey` are configured, the
feeder also pushes each miner's `totals.json` to hashboard.live
(`POST /api/push/totals`) right after writing it locally, so a remote board
shows the same persistent totals. hashboard stores it verbatim — it performs
no computation of its own, same principle as the rest of what gets pushed.

---

## Firmware Update Detection

The feeder checks GitHub for the latest release once per `firmware.cacheTTL` (default 24h) for each unique model in the config. Results are cached in `{dataDir}/data/firmware_cache.json`.

Each miner in the API response includes:

```json
{
  "version": "v2.4.0",
  "latestVersion": "v2.5.1",
  "updateAvailable": true
}
```

`updateAvailable` is `false` on first run (before the feeder completes a cycle) or when already up to date.
