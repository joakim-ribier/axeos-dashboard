# axeos-dashboard

[![Checks](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml)
[![Latest Release](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/latest.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)](server/go.mod)

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network.

Two Go binaries handle data collection and the REST API; a React SPA provides the UI. No authentication — internal LAN use only.

**Supported models (tested firmware):** Bitaxe Gamma (up to `v2.15.1`) · NerdQAxe++ (up to `V1.0.37.3-LTS`)

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

See [`readme/FEATURES.md`](readme/FEATURES.md) for the full breakdown of every screen.

---

## Documentation

| Doc | Covers |
|-----|--------|
| [readme/CONFIGURATION.md](readme/CONFIGURATION.md) | `dashboard.yml` / `settings.yml` / `miners.yml` — every field, full examples |
| [readme/FEATURES.md](readme/FEATURES.md) | Every dashboard screen: top bar, filters, alerts, miner card, remote mode, persistent totals, firmware detection |
| [readme/TESTING.md](readme/TESTING.md) | Running the Go/UI test suites, what CI runs |
| [readme/DEPLOYMENT.md](readme/DEPLOYMENT.md) | Step-by-step Raspberry Pi setup: nginx reverse proxy, systemd, building from source |
| [readme/plan.md](readme/plan.md) | Running development plan — ideas, in-progress features, known bugs to fix |

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

The recommended Raspberry Pi setup (`make latest-up` — see
[readme/DEPLOYMENT.md](readme/DEPLOYMENT.md)) fetches prebuilt binaries and a
prebuilt UI, so no Go or Node toolchain is needed at all on the Pi.

Go and Node are only needed if you build from source instead, or for local development:

```bash
apt install -y golang nodejs npm
```

nginx isn't needed to run axeos-dashboard itself — it's only used for the
optional reverse-proxy step in [readme/DEPLOYMENT.md](readme/DEPLOYMENT.md),
which lets you drop the `:8080` from the URL.

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

Config format (`dashboard.yml` / `settings.yml` / `miners.yml`) is
documented in [readme/CONFIGURATION.md](readme/CONFIGURATION.md).

---

## Deployment

Recommended for a Raspberry Pi: fetch the prebuilt `linux/arm64` release
(CI-built on every push to `main`) instead of building locally — no Go
toolchain needed on the Pi.

```bash
git clone https://github.com/joakim-ribier/axeos-dashboard.git
cd axeos-dashboard
make latest-up
```

This starts dashboard-api + feeder in a background screen session, reachable
at `http://<pi-ip>:8080` — open `/settings` there to scan the LAN for
miners (or add them by IP) and start collecting data, no config file to
hand-write first.

**→ See [readme/DEPLOYMENT.md](readme/DEPLOYMENT.md)** for the full
step-by-step: nginx as a reverse proxy (so you can drop the `:8080` and just
open `http://<pi-ip>/`), systemd (survive reboots), and building from source
instead of using the prebuilt release.

---

## API Reference

Base URL: `http://localhost:8080`. Config is loaded once at startup — restart the binaries after any config change.

Full OpenAPI spec (both dashboard-api and remote-dashboard-api):
[`swagger.yaml`](server/docs/swagger/swagger.yaml) /
[`swagger.json`](server/docs/swagger/swagger.json) — paste either into
[editor.swagger.io](https://editor.swagger.io) for a browsable view.

---

## AxeOs Device API

Full device API docs: https://osmu.wiki/bitaxe/api/

---

## License

[MIT](LICENSE) © Joakim Ribier
