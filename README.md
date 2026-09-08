# axeos-dashboard

[![Checks](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml)
[![Latest Release](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/latest.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)](server/go.mod)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-00b4ff)](https://joakim-ribier.github.io/axeos-dashboard/)

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network.

Two Go binaries handle data collection and the REST API; a React SPA provides the UI. No authentication — internal LAN use only.

**Easy to use** — one line, everything else configured from the UI:

```bash
curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | bash
```

See the [user documentation](https://joakim-ribier.github.io/axeos-dashboard/)
for supported models, tested firmware versions and the full feature
list, or [`readme/FEATURES.md`](readme/FEATURES.md)
for the breakdown of every screen.

---

## Documentation

| Doc | Covers |
|-----|--------|
| [User documentation](https://joakim-ribier.github.io/axeos-dashboard/) | Installation, configuration and features, EN/FR |
| [readme/FEATURES.md](readme/FEATURES.md) | Every dashboard screen: top bar, filters, alerts, miner card, remote mode, persistent totals, firmware detection |
| [readme/TESTING.md](readme/TESTING.md) | Running the Go/UI test suites, what CI runs |
| [readme/DEPLOYMENT.md](readme/DEPLOYMENT.md) | Docker install/update, building the images yourself |
| [readme/plan.md](readme/plan.md) | Running development plan — ideas, in-progress features, known bugs to fix |

---

## Prerequisites

The recommended setup (Docker, below) needs nothing but Docker itself
installed — no Go, Node, or nginx on the machine at all. See the
[Architecture page](https://joakim-ribier.github.io/axeos-dashboard/#architecture)
in the user documentation for how the feeder, dashboard API and UI fit
together.

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

`dashboard.yml` field reference is in the
[Installation page](https://joakim-ribier.github.io/axeos-dashboard/installation.html#parametrage)
of the user documentation.

---

## Deployment

Full walkthrough (Docker install, fixed port, updating) is in the
[Installation page](https://joakim-ribier.github.io/axeos-dashboard/installation.html)
of the user documentation.

**→ See [readme/DEPLOYMENT.md](readme/DEPLOYMENT.md)** for advanced,
dev-only topics: testing a PR's images, and building the images yourself
instead of pulling the prebuilt ones.

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
