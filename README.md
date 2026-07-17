# axeos-dashboard

[![Checks](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)](server/go.mod)

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network.

Two Go binaries handle data collection and the REST API; a React SPA provides the UI. No authentication — internal LAN use only.

**Supported models (tested firmware):** Bitaxe Gamma (`v2.14.1`) · NerdQAxe++ (`V1.0.37.2-LTS`)

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
         pushes to hashboard.live if remote.apiKey is set
    ↓  reads latest.json
miner-api → REST API at /api/miners/*
    ↓  axios + TanStack Query
React UI → display + control (restart / pool switch / WiFi)
```

---

## Prerequisites

For the recommended Raspberry Pi setup (`make latest-up` — see [Production Deployment](#production-deployment)):
nginx, to serve the UI and reverse-proxy the API. No Go, no Node — the release
binaries are prebuilt, and the UI is a static build served by nginx.

```bash
apt install -y nginx
```

Go and Node are only needed if you build from source instead of fetching the
prebuilt release, or for local development:

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
feeder/dashboard-api/remote-dashboard-api binaries for `linux/arm64` plus the
UI, and publishes them to a rolling `latest` GitHub Release. Fetch them on a
Raspberry Pi with `make latest-up` (no local Go/npm build needed) — see the
Makefile's `latest-fetch`/`latest-up`/`latest-down` targets.

---

## Production Deployment

Recommended for a Raspberry Pi: fetch the prebuilt `linux/arm64` release (CI-built on every push to `main`) instead of building locally — no Go toolchain needed on the Pi.

### 1. Clone

```bash
git clone https://github.com/joakim-ribier/axeos-dashboard.git
cd axeos-dashboard
```

### 2. Configure

`dashboard.yml` is already committed with sane defaults — edit `resources/dashboard.yml` for your setup (electricity rate, pool dashboards, firmware repos, etc.).

**Create `resources/miners.yml` before going further.** It's gitignored (holds your pool credentials) so it does **not** exist on a fresh clone — copy the full example from [Configuration](#configuration) below and fill in your miners' IPs, models, and pool credentials.

### 3. Install and configure nginx (one-time)

nginx serves the static UI (`ui/dist`) and reverse-proxies `/api` to dashboard-api,
on port 80 — so you can just open `http://<pi-ip>/` from any device on your LAN,
no port number to remember. Same pattern as the
[hashboard](https://github.com/joakim-ribier/hashboard) VPS deployment, just
without TLS/domains since this is LAN-only.

#### 3.1. Install

```bash
sudo apt update
sudo apt install -y nginx
```

#### 3.2. Create the site config

Create `/etc/nginx/sites-available/axeos-dashboard` — **replace
`/path/to/axeos-dashboard` with the absolute path to your clone** (from step 1,
e.g. `/home/pi/axeos-dashboard`):

```nginx
server {
    listen 80 default_server;
    server_name _;

    # Everything under /api/ → dashboard-api (started by `make latest-up`)
    location /api/ {
        proxy_pass http://localhost:8080;
    }

    # Everything else → the static UI, falling back to index.html for
    # client-side routes (this is a single-page app — see the SPA explainer
    # earlier in this doc if that's unfamiliar)
    location / {
        root /path/to/axeos-dashboard/ui/dist;
        try_files $uri /index.html;
    }
}
```

If dashboard-api's port isn't the default `8080` (see `MINER_API_PORT` below),
update the `proxy_pass` line to match.

#### 3.3. Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/axeos-dashboard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # avoid a conflicting default_server on :80
sudo nginx -t                                 # validates the config syntax
sudo systemctl reload nginx
```

`sudo nginx -t` should print `syntax is ok` / `test is successful` — if it
doesn't, fix the reported line before reloading.

#### 3.4. Fix the home directory permission (if your clone lives under `~`)

nginx runs as the `www-data` user, which by default **cannot traverse into your
home directory** — home directories are typically `700` (owner-only). If you skip
this, every request will 500, and `sudo tail /var/log/nginx/error.log` will show:

```
[crit] ... stat() "/home/you/axeos-dashboard/ui/dist/index.html" failed
(13: Permission denied)
```

Fix (only needs to be done once):

```bash
chmod o+x ~
```

This grants **traversal only** ("can pass through", not "can list contents") to
your home directory — it doesn't expose any other files there. Everything below
it (`axeos-dashboard/`, `ui/`, `dist/`, and the files inside) already ships with
normal `755`/`644` permissions from `git clone`, so this one `chmod` is enough —
you don't need to touch anything else in the path.

If you cloned outside your home directory entirely (e.g. `/opt/axeos-dashboard`),
you likely don't need this step at all.

#### 3.5. Verify

```bash
curl -I http://localhost/                # expect: HTTP/1.1 200, Content-Type: text/html
curl -I http://localhost/some/route      # expect: 200 too (SPA fallback to index.html)
curl -I http://localhost/api/miners      # expect: 200 (or 401/whatever dashboard-api itself returns)
```

Then open `http://<pi-ip>/` from another device on the same network.

You won't need to touch nginx again after this — it keeps running as a system
service, and automatically serves whatever is currently in `ui/dist`. Re-running
`make latest-up` (step 4) overwrites `ui/dist` with the newest release; nginx
picks it up on the very next request, no reload needed.

### 4. Run

```bash
make latest-up
```

Downloads the feeder/dashboard-api/remote-dashboard-api binaries (and the UI into
`ui/dist`, for nginx to serve) from the latest GitHub Release, and starts
dashboard-api + feeder in a GNU screen session. nginx itself isn't managed by this
command — it's a system service, configured once in step 3, that keeps running and
just picks up new files whenever `latest-fetch`/`latest-up` refreshes `ui/dist`.

```bash
make latest-down   # stop dashboard-api + feeder
make dev-attach    # attach to the screen session
make dev-status    # list running sessions
```

### 5. Survive reboots (systemd)

nginx already auto-starts on boot (it's a systemd service by default). `make
latest-up` doesn't — it's a screen session, which doesn't survive a reboot — so
without this step, a power cycle leaves the UI reachable (served statically by
nginx) but `/api/*` dead until you SSH in and rerun `make latest-up` by hand.

Create `/etc/systemd/system/axeos-dashboard.service` — **replace both paths**
with your actual clone location and config file paths from steps 1–2:

```ini
[Unit]
Description=axeos-dashboard (dashboard-api + feeder via make latest-up)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/axeos-dashboard
ExecStart=/usr/bin/make latest-up CONFIG_FILE=/path/to/config.yml MINERS_FILE=/path/to/miners.yml
ExecStop=/usr/bin/make latest-down
Restart=on-failure
RestartSec=15
User=your-username

[Install]
WantedBy=multi-user.target
```

`Type=oneshot` + `RemainAfterExit=yes` because `make latest-up` itself returns
quickly once it has spawned the detached screen session — the actual
long-running processes (dashboard-api, feeder) live inside that session, not as
children systemd tracks directly. `Restart=on-failure` retries if `latest-fetch`
fails (e.g. network not ready yet at boot), even though `After=network-online.target`
should normally prevent that.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now axeos-dashboard
```

Every start (including after every reboot) re-runs `make latest-up`, so it
fetches whatever is the current `latest` GitHub Release at that moment — same
self-updating behavior as running it by hand.

Verify:

```bash
sudo systemctl status axeos-dashboard --no-pager   # Active: active (exited); processes listed under CGroup
curl -I http://localhost/api/miners                # 200 once dashboard-api is up
```

Manage it like any systemd service from here on:

```bash
sudo systemctl stop axeos-dashboard      # runs `make latest-down`
sudo systemctl restart axeos-dashboard   # re-fetches + restarts
sudo journalctl -u axeos-dashboard -f    # follow logs
```

### Building from source instead (advanced)

`make dev-up`/`make build` are for local development (e.g. testing a change before opening a PR) — not recommended for deploying on a Pi, since it means installing the Go toolchain there. If you still want to build locally instead of using `make latest-up`:

```bash
make build
# → resources/build/server/bin/feeder
# → resources/build/server/bin/dashboard-api
# → resources/build/server/bin/remote-dashboard-api
```

Or run the binaries manually (background processes):

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

# UI (static build served by nginx as configured in step 3, or `npm run dev` for local testing)
cd ui && npm run build   # → ui/dist/
```

Override API port (default `8080`):

```bash
MINER_API_PORT=9090 ./resources/build/server/bin/dashboard-api -config dashboard.yml -miners miners.yml
```

Override dashboard-api/feeder's local data dir (default from config's `storage.dataDir`):

```bash
BITAXE_DATA_ROOT=/path/to/data ./resources/build/server/bin/dashboard-api -config dashboard.yml -miners miners.yml
```

remote-dashboard-api has no env var override — its data dir is `storage.boardsDir`
in `remote-dashboard.yml` (defaults to `{dataDir}/data/boards` when empty).

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

Base URL: `http://localhost:8080`. Config is loaded once at startup — restart the binaries after any config change.

Full reference (both dashboard-api and remote-dashboard-api), generated from Go
annotations with [swaggo/swag](https://github.com/swaggo/swag):
[`swagger.yaml`](server/docs/swagger/swagger.yaml) /
[`swagger.json`](server/docs/swagger/swagger.json). For a browsable view, paste
the file into [editor.swagger.io](https://editor.swagger.io).

Regenerate after changing a handler's annotations:

```bash
make swagger
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
