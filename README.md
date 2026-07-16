# axeos-dashboard

[![Checks](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)](server/go.mod)

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network.

Two Go binaries handle data collection and the REST API; a React SPA provides the UI. No authentication — internal LAN use only.

**Supported models:** bitaxe · nerdaxe

**Key features:**
- Real-time hashrate, temperature, fan speed, shares and uptime per miner
- Pool switching (primary ↔ fallback) with optional cron-based schedule
- Firmware update detection (GitHub releases, configurable per model)
- Intraday stats chart — last hour or full day (hourly averages)
- Electricity cost estimation based on configured €/kWh rate
- Clickable pool dashboard links (Braiins, Atlas, …) auto-resolved from stratum user
- Health check loop with live reachability indicator per miner card
- EN / FR localization

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start (dev)](#quick-start-dev)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
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
feeder → writes  {dataDir}/{ip}/YYYY-MM-DD.jsonl  (append)
                 {dataDir}/{ip}/latest.json        (overwrite)
    ↓  reads latest.json
miner-api → REST API at /api/miners/*
    ↓  axios + TanStack Query
React UI → display + control (restart / pool switch / WiFi)
```

---

## Prerequisites

```bash
apt install -y golang nodejs npm
```

---

## Quick Start (dev)

```bash
make build
make run-feeder        CONFIG=resources/dashboard.yml MINERS_FILE=resources/miners.yml
make run-dashboard-api CONFIG=resources/dashboard.yml MINERS_FILE=resources/miners.yml
make run-dashboard-ui  # Vite dev server on :5173, proxies /api → :8080
```

To view remote miners pushed to hashboard:

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
feeder/dashboard-api/remote-dashboard-api binaries for `linux/arm64` plus the
UI, and publishes them to a rolling `latest` GitHub Release. Fetch them on a
Raspberry Pi with `make latest-up` (no local Go/npm build needed) — see the
Makefile's `latest-fetch`/`latest-up`/`latest-down` targets.

---

## Production Deployment

### 1. Build

```bash
make build
# → resources/build/server/bin/feeder
# → resources/build/server/bin/dashboard-api
# → resources/build/server/bin/remote-dashboard-api
```

### 2. Prepare config files

See [Configuration](#configuration) below. Keep `miners.yml` **out of git**.

### 3. Run

Using `make dev-up` (recommended — starts all services in a GNU screen session):

```bash
make dev-up \
  CONFIG_FILE=/home/{{user}}/axeos-dashboard/config.yml \
  MINERS_FILE=/home/{{user}}/axeos-dashboard/miners.yml
```

Or manually (background processes):

```bash
# Feeder (background)
nohup ./resources/build/server/bin/feeder \
  -config /path/to/dashboard.yml \
  -miners /path/to/miners.yml \
  > feeder.log 2>&1 &

# Dashboard API (background)
nohup ./resources/build/server/bin/dashboard-api \
  -config /path/to/dashboard.yml \
  -miners /path/to/miners.yml \
  > dashboard-api.log 2>&1 &

# UI (static build served by any HTTP server, or keep Vite running)
cd ui && npm run build   # → ui/dist/
```

Override API port (default `8080`):

```bash
MINER_API_PORT=9090 ./resources/build/server/bin/dashboard-api -config dashboard.yml -miners miners.yml
```

Override remote-dashboard-api data dir (default from `remote-dashboard.yml`):

```bash
BITAXE_DATA_ROOT=/path/to/remote/data/boards \
  ./resources/build/server/bin/remote-dashboard-api -config resources/remote-dashboard.yml   # remote-dashboard-api
```

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

```yaml
bitaxes:
  - ip: "192.168.1.65"
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
    enabled: false    # disabled miners are ignored by feeder and API
    hostname: "spare"
    model: "bitaxe"
    url:  "stratum.braiins.com"
    port: 3333
    user: "wallet.worker3"
```

---

## API Reference

Base URL: `http://localhost:8080`

> Config is loaded once at startup — restart the binaries after any config change.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/miners/` | All miners with latest snapshot |
| `GET` | `/api/miners/{hostnameOrIp}/stats` | Today's JSONL entries for one miner |
| `POST` | `/api/miners/{hostnameOrIp}/restart` | Restart a device |
| `PUT` | `/api/miners/pool/{primary\|fallback}/enable` | Switch pool — all miners; add `?miner=<hostnameOrIp>` for one |
| `PUT` | `/api/miners/set/wifi` | Update WiFi credentials — all miners; add `?miner=<hostnameOrIp>` for one |

`{hostnameOrIp}` accepts either the device IP or the configured `hostname`.

```bash
# List miners
curl http://localhost:8080/api/miners/

# Switch all miners to fallback pool
curl -X PUT 'http://localhost:8080/api/miners/pool/fallback/enable'

# Switch one miner by hostname
curl -X PUT 'http://localhost:8080/api/miners/pool/primary/enable?miner=bitaxe-1'

# Restart by IP
curl -X POST 'http://localhost:8080/api/miners/192.168.1.65/restart'
```

---

## Dashboard Features

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
- Health dot: green (alive) · red (unreachable) · grey (first check pending)

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
