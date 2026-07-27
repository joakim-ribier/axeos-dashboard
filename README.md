# axeos-dashboard

[![Checks](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml)
[![Latest Release](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/latest.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)](server/go.mod)

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network.

Two Go binaries handle data collection and the REST API; a React SPA provides the UI. No authentication — internal LAN use only.

**Supported models (tested firmware):** Bitaxe Gamma (`v2.14.1`) · NerdQAxe++ (`V1.0.37.2-LTS`)

**Key features:**
- Real-time hashrate, temperature, fan speed, shares and uptime per miner
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
make run-feeder        CONFIG=resources/dashboard.yml MINERS_FILE=resources/miners.yml
make run-dashboard-api CONFIG=resources/dashboard.yml MINERS_FILE=resources/miners.yml
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
feeder/dashboard-api/remote-dashboard-api binaries for **both `linux/arm64`
(Raspberry Pi) and `linux/amd64` (typical VPS)**, builds the UI once, and
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
| `miners.yml` | List of miners (`bitaxes:` section) with IPs, pool credentials, cron schedules | **No — add to `.gitignore`** |

If `-miners` is omitted, the `bitaxes:` section of `dashboard.yml` is used (backward compatible).

---

### `dashboard.yml` — full example

```yaml
global:
  env: dev          # "dev" → stdout only; anything else → writes log files

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

- **Notifications** — bell icon with an unread-count badge; opens a list of recent events (temp/fan thresholds crossed, miner offline/online, config errors, firmware updates, dashboard app updates) with a **Clear** button
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

### Notification settings

Configurable from the gear icon in the page header (opens in place of the filters panel):

- Temp threshold (°C, default 62) and fan threshold (%, default 75)
- Toggles: notify on temperature, fan speed, offline, firmware update available, firmware update applied
- Config-mismatch errors (see below) always notify, regardless of these toggles

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
