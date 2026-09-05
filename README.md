# axeos-dashboard

[![Checks](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml)
[![Latest Release](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/latest.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)](server/go.mod)

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network.

**Easy to use** — one line, everything else configured from the UI:

```bash
curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | bash
```

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
- Optional remote view via [hashboard.live](https://hashboard.live) — check your miners from anywhere, no VPN, including a read-only view of your configured miners and app settings
- EN / FR localization

See [`readme/FEATURES.md`](readme/FEATURES.md) for the full breakdown of every screen.

---

## Documentation

| Doc | Covers |
|-----|--------|
| [readme/CONFIGURATION.md](readme/CONFIGURATION.md) | `dashboard.yml` / `settings.yml` / `miners.yml` — every field, full examples |
| [readme/FEATURES.md](readme/FEATURES.md) | Every dashboard screen: top bar, filters, alerts, miner card, remote mode, persistent totals, firmware detection |
| [readme/TESTING.md](readme/TESTING.md) | Running the Go/UI test suites, what CI runs |
| [readme/DEPLOYMENT.md](readme/DEPLOYMENT.md) | Docker install/update, building the images yourself |
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

The recommended setup ([Docker](#deployment), below) needs nothing but
Docker itself installed — no Go, Node, or nginx on the machine at all.

Go and Node are only needed for local development, or to build the images
yourself instead of pulling the prebuilt ones:

```bash
apt install -y golang nodejs npm
```

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

One line, on any machine with Docker installed (Linux, Windows, macOS, a
NAS, a Raspberry Pi...) — no clone, no Go/Node toolchain, no manual nginx
or systemd setup:

```bash
curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | bash
```

That's it — 2 prebuilt multi-arch images (CI-built on every push to
`main`) get pulled and started; it prints which port it landed on. Open
that in a browser, then use **Settings** to scan the LAN for miners (or
add them by IP) — no config file to hand-write first. Re-run the same
command later to update.

**→ See [readme/DEPLOYMENT.md](readme/DEPLOYMENT.md)** for the full
details: a fixed port instead of the random default, testing a PR's images,
and building the images yourself instead of pulling the prebuilt ones.

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
