# axeos-dashboard

[![Checks](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml)
[![Latest Release](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/latest.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)](server/go.mod)

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network.

Two Go binaries handle data collection and the REST API; a React SPA provides the UI. No authentication — internal LAN use only.

**Supported models (tested firmware):** Bitaxe Gamma (up to `v2.15.0`) · NerdQAxe++ (up to `V1.0.37.3-LTS`)

**Key features:**
- Real-time hashrate, temperature, fan speed, shares and uptime per miner
- Persistent lifetime totals (uptime + shares accepted) per miner that survive device reboots, shown alongside the live session values
- Server-computed alerts (temp/fan thresholds, offline, config mismatch, firmware update) — a live notification bell plus a paginated, filterable, day-scoped alert history page (grouped into episodes, not one row per poll)
- Pool switching (primary ↔ fallback), manual or on a cron-based schedule
- Firmware update detection against GitHub releases, per device model
- Today's history chart — last hour or full day, hourly averages
- Electricity cost estimate (daily/monthly) from your configured €/kWh rate
- Clickable pool dashboard links (Braiins, Atlas, …), auto-resolved from the stratum user
- Live reachability check, plus a config-mismatch warning if a device doesn't match its configured MAC
- Optional remote view via [hashboard.live](https://hashboard.live) — check your miners from anywhere, no VPN
- EN / FR localization

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start (dev)](#quick-start-dev)
- [Testing](#testing)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Dashboard Features](#dashboard-features)
- [Persistent Totals](#persistent-totals)
- [Firmware Update Detection](#firmware-update-detection)
- [AxeOs Device API](#axeos-device-api)
- [License](#license)

---

## Architecture

```
Bitaxe devices (HTTP)
    ↓  poll every 2m  (GET /api/system/info)
feeder → writes  {dataDir}/{mac}/YYYY-MM-DD.jsonl  (append)
                 {dataDir}/{mac}/latest.json        (overwrite)
         pushes to hashboard.live if remote.apiKey is set
    ↓  reads latest.json
miner-api → REST API at /api/miners/*
    ↓  axios + TanStack Query
React UI → display + control (restart / pool switch / WiFi)
```

---

## Prerequisites

The recommended Raspberry Pi setup (`make latest-up` — see [Deployment](#deployment))
fetches prebuilt binaries and a prebuilt UI, so no Go or Node toolchain is
needed at all on the Pi.

Go and Node are only needed if you build from source instead, or for local development:

```bash
apt install -y golang nodejs npm
```

nginx isn't needed to run axeos-dashboard itself — it's only used for the
optional reverse-proxy step in [Deployment](#deployment), which lets you drop
the `:8080` from the URL.

---

## Quick Start (dev)

```bash
make build
make run-feeder        CONFIG=resources/dashboard.yml
make run-dashboard-api CONFIG=resources/dashboard.yml
make run-dashboard-ui  # Vite dev server on :5173, proxies /api → :8080
```

To view remote miners pushed to https://hashboard.live:

```bash
make run-remote-dashboard-api  # read-only API on :8081, reads resources/remote-dashboard.yml
make run-remote-dashboard-ui   # Vite dev server → :8081; open /{boardId} in browser
```

---

## Testing

### Backend (Go)

```bash
make test   # go test ./... -race -cover, run from server/
```

Tests live next to the code as `*_test.go` files, using only the standard
library (`testing`, `net/http/httptest`) — no test framework dependency.
Coverage focuses on pure logic (config, payload mapping, firmware cache) and
HTTP handlers.

### Frontend (React)

```bash
cd ui
npm run test         # vitest run — single pass, what CI runs
npm run test:watch   # vitest — watch mode for local development
```

Built with [Vitest](https://vitest.dev) and [React Testing Library](https://testing-library.com/react).

### Continuous Integration

Every push to `main` and every pull request targeting `main` runs
[`.github/workflows/checks.yml`](.github/workflows/checks.yml):

| Job | Steps |
|-----|-------|
| `go` | `go vet` → `golangci-lint` → `go test -race -cover` |
| `ui` | `npm run typecheck` → `npm run lint` → `npm run test` |

When `checks.yml` succeeds on `main`,
[`.github/workflows/latest.yml`](.github/workflows/latest.yml) builds the
feeder/dashboard-api/remote-dashboard-api/rebuild-totals binaries for **both
`linux/arm64` (Raspberry Pi) and `linux/amd64` (typical VPS)**, builds the UI once, and
publishes everything to a rolling `latest` GitHub Release. `make latest-fetch`
auto-detects the local architecture (`uname -m`) and pulls the matching
binaries — no need to specify it manually, override with `RELEASE_ARCH=` if
detection ever guesses wrong.

- `make latest-up` / `make latest-down` — Pi: dashboard-api + feeder
- `make latest-remote-up` / `make latest-remote-down` — VPS: remote-dashboard-api only

Neither needs a local Go or npm build — see the Makefile's
`latest-fetch`/`latest-up`/`latest-remote-up` targets.

---

## Deployment

Recommended for a Raspberry Pi: fetch the prebuilt `linux/arm64` release
(CI-built on every push to `main`) instead of building locally — no Go
toolchain needed on the Pi.

```bash
git clone https://github.com/joakim-ribier/axeos-dashboard.git
cd axeos-dashboard
# create resources/miners.yml (gitignored — see Configuration below), then:
make latest-up
```

This starts dashboard-api + feeder in a background screen session, reachable
at `http://<pi-ip>:8080`.

**→ See [DEPLOYMENT.md](DEPLOYMENT.md)** for the full step-by-step: nginx as a
reverse proxy (so you can drop the `:8080` and just open `http://<pi-ip>/`),
systemd (survive reboots), and building from source instead of using the
prebuilt release.

---

## Configuration

The config is split into **two files** to keep sensitive miner details out of the repository.

| File | Content | Committed to git |
|------|---------|-----------------|
| `dashboard.yml` | Global settings: intervals, endpoints, storage, electricity rate, pool dashboards, firmware repos | Yes |
| `miners.yml` | List of miners (`bitaxes:` section) with IPs, pool credentials, cron schedules — managed by the `/settings` page (network discovery + add-by-IP), or hand-edited for advanced fields like `poolSchedule` | **No — add to `.gitignore`** |

No flag needed: `miners.yml` is expected right next to whatever file you pass
to `-config` — feeder and dashboard-api always agree on the same one, so
there's no way for the two to end up watching different files. To put it
somewhere else, set `minersFile: /path/to/miners.yml` at the top level of
`dashboard.yml` instead of passing a path on the command line. A `bitaxes:`
block written directly in `dashboard.yml` is **not** read — miners always
come from the managed file. `-miners <path>` still exists on the command
line for backward compatibility, but is deprecated and ignored (logs a
warning) — safe to drop from any script that still passes it.

---

### `dashboard.yml` — full example

```yaml
global:
  env: dev          # "dev" → stdout only; anything else → writes log files

# minersFile: /path/to/miners.yml   # optional -- defaults to "miners.yml" next to this file

storage:
  dataDir: resources/data/bitaxes   # one sub-folder per miner IP

feeder:
  interval: 2m      # how often to poll each device

healthCheck:
  interval: 15s     # background reachability ping interval

endpoints:
  timeout: 5s
  info:    api/system/info       # GET  — read device stats
  system:  api/system            # PUT  — push pool / wifi settings
  restart: api/system/restart    # POST — restart device

electricity:
  ratePerKwh: 0.1915   # €/kWh — used to estimate daily/monthly cost in the dashboard
                        # stored in every JSONL entry so historical rate is preserved

pools:
  dashboards:
    # Maps stratum hostname → web dashboard URL template
    # {user} is replaced by the account part of the stratum user (before the first dot)
    stratum.braiins.com: "https://pool.braiins.com/mining/overview/{user}"
    solo.atlaspool.io:   "https://atlaspool.io/dashboard.html?wallet={user}"

firmware:
  cacheTTL: 24h     # how long to cache the GitHub latest-release response
  # Same URL is used to build the "view release" link on the update badge
  repos:
    bitaxe:   "https://api.github.com/repos/bitaxeorg/esp-miner/releases/latest"
    nerdaxe:  "https://api.github.com/repos/shufps/ESP-Miner-NerdQAxePlus/releases/latest"

wifi:
  on:   false
  ssid: ""
  pwd:  ""

remote:
  pushURL: ""   # push URL from your hashboard dashboard (e.g. https://hashboard.live/api/push)
  apiKey:  ""   # API key from your hashboard dashboard
```

---

### `miners.yml` — full example

Storage is keyed by each device's MAC address (`mac:`), not its IP -- so
it's worth reserving/fixing each device's IP via your router's DHCP anyway
(the pool/wifi settings below are already tied to a specific `ip:`, so a
stable IP matters regardless).

```yaml
bitaxes:
  - ip: "192.168.1.65"        # reserve this via DHCP so it never changes
    mac: "aa:bb:cc:dd:ee:ff"  # paste the device's real MAC as-is -- separators optional, normalized automatically
    enabled: true
    hostname: "bitaxe-1"      # shown in the UI; optional
    model: "bitaxe"           # "bitaxe" or "nerdaxe"

    # Primary stratum pool
    url:  "stratum.braiins.com"
    port: 3333
    user: "wallet.worker1"

    # Fallback stratum pool (switched to automatically via poolSchedule or manually in the UI)
    fallbackUrl:  "solo.atlaspool.io"
    fallbackPort: 3333
    fallbackUser: "bc1qxxx...xxx"

    # Optional: cron-based automatic pool switching (robfig/cron v3, seconds precision, local timezone)
    poolSchedule:
      - cron: "0 0 0 * * SAT"   # Friday 23:59 local → switch to fallback (solo)
        target: fallback
      - cron: "0 0 0 * * MON"   # Sunday 23:59 local → switch back to primary
        target: primary

  - ip: "192.168.1.66"
    mac: "aa:bb:cc:dd:ee:02"
    enabled: true
    hostname: "nerdaxe-1"
    model: "nerdaxe"
    url:  "stratum.braiins.com"
    port: 3333
    user: "wallet.worker2"
    fallbackUrl:  "solo.atlaspool.io"
    fallbackPort: 3333
    fallbackUser: "bc1qxxx...xxx"

  - ip: "192.168.1.67"
    mac: "aa:bb:cc:dd:ee:03"
    enabled: false    # disabled miners are ignored by feeder and API
    hostname: "spare"
    model: "bitaxe"
    url:  "stratum.braiins.com"
    port: 3333
    user: "wallet.worker3"
```

---

## API Reference

Base URL: `http://localhost:8080`. Config is loaded once at startup — restart the binaries after any config change.

Full OpenAPI spec (both dashboard-api and remote-dashboard-api):
[`swagger.yaml`](server/docs/swagger/swagger.yaml) /
[`swagger.json`](server/docs/swagger/swagger.json) — paste either into
[editor.swagger.io](https://editor.swagger.io) for a browsable view.

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
| Total shares | Accepted shares across all miners, with trend |
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
mismatch check in [Configuration](#configuration).

### Remote mode (`/{boardId}`)

- **Private board** — visitors see a "this board is private" page with an
  email field; submitting requests a magic-link access email from hashboard
  (always shows the same generic confirmation, whether or not the email
  matches the board — no account enumeration)
- **Unknown or empty board** — a "page not found" message

---

## Persistent Totals

Live values like `uptimeSeconds` and `sharesAccepted` are raw counters
reported by the device itself — they reset to ~0 whenever the miner reboots.
Alongside them, the dashboard tracks a **persistent total** per miner (total
uptime, total shares accepted) that keeps growing across reboots instead of
resetting.

**How it works** — on every feeder poll, `internal/storage.ApplyPoll`
compares the device's current raw counter to the last value it saw. If it
went up, the delta is added to the running total. If it went *down* (the
device rebooted and its own counter reset), the new value is added directly
instead of a negative delta, so the reboot never loses progress. The result
is written to `{dataDir}/{mac}/totals.json`, next to `latest.json` — a small
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
- **Config-driven, not filesystem-driven** — only miners present in your `dashboard.yml`/`miners.yml` are processed, so a stray leftover directory under `{dataDir}` is never picked up silently.
- Read-only on `.jsonl`/`latest.json` — the only file it ever writes is `totals.json`.

**Remote mode** — when `remote.pushURL`/`remote.apiKey` are configured, the
feeder also pushes each miner's `totals.json` to hashboard.live
(`POST /api/push/totals`) right after writing it locally, so a remote board
shows the same persistent totals. hashboard stores it verbatim — it performs
no computation of its own, same principle as the rest of what gets pushed.

---

## Firmware Update Detection

The feeder checks GitHub for the latest release once per `firmware.cacheTTL` (default 24h) for each unique model in the config. Results are cached in `{dataDir}/firmware_cache.json`.

Each miner in the API response includes:

```json
{
  "version": "v2.4.0",
  "latestVersion": "v2.5.1",
  "updateAvailable": true
}
```

`updateAvailable` is `false` on first run (before the feeder completes a cycle) or when already up to date.

---

## AxeOs Device API

Full device API docs: https://osmu.wiki/bitaxe/api/

---

## License

[MIT](LICENSE) © Joakim Ribier
