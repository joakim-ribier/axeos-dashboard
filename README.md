# axeos-dashboard

📖 **[Documentation](https://joakim-ribier.github.io/axeos-dashboard/en/)** — supported models, tested firmware versions, full breakdown of every screen.

[![Checks](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml)
[![Latest Release](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/latest.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)](server/go.mod)

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network.

Two Go binaries handle data collection and the REST API; a React SPA provides the UI. No authentication — internal LAN use only.

**Easy to use** — one line, everything else configured from the UI:

```bash
curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | bash
```

---

## Prerequisites

The recommended setup (Docker, below) needs nothing but Docker itself
installed — no Go, Node, or nginx on the machine at all. See the
[Architecture page](https://joakim-ribier.github.io/axeos-dashboard/en/#architecture)
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
[Installation page](https://joakim-ribier.github.io/axeos-dashboard/en/installation.html#config-file)
of the user documentation.

---

## Testing

```bash
make test   # go test ./... -race -cover, run from server/
```

Tests live next to the code as `*_test.go` files, using only the standard
library (`testing`, `net/http/httptest`) — no test framework dependency.
Coverage focuses on pure logic (config, payload mapping, firmware cache) and
HTTP handlers.

```bash
cd ui
npm run test         # vitest run — single pass, what CI runs
npm run test:watch   # vitest — watch mode for local development
```

Built with [Vitest](https://vitest.dev) and [React Testing Library](https://testing-library.com/react).

**Continuous Integration** — every push to `main` and every pull request
targeting `main` runs
[`.github/workflows/checks.yml`](.github/workflows/checks.yml):

| Job | Steps |
|-----|-------|
| `go` | `go vet` → `golangci-lint` → `go test -race -cover` |
| `ui` | `npm run typecheck` → `npm run lint` → `npm run test` |

When `checks.yml` succeeds on `main`,
[`.github/workflows/latest.yml`](.github/workflows/latest.yml) builds the
feeder/dashboard-api/remote-dashboard-api/rebuild-totals binaries for **both
`linux/arm64` (Raspberry Pi) and `linux/amd64` (typical VPS)**, builds the UI
once, and publishes everything to a rolling `latest` GitHub Release.
`make latest-fetch` auto-detects the local architecture (`uname -m`) and
pulls the matching binaries — no need to specify it manually, override with
`RELEASE_ARCH=` if detection ever guesses wrong.

- `make latest-up` / `make latest-down` — Pi: dashboard-api + feeder
- `make latest-remote-up` / `make latest-remote-down` — VPS: remote-dashboard-api only

Neither needs a local Go or npm build — see the Makefile's
`latest-fetch`/`latest-up`/`latest-remote-up` targets.

---

## Deployment

Full walkthrough (Docker install, fixed port, updating, pinning a specific
image via `IMAGE_TAG` to test a PR's build) is in the
[Installation page](https://joakim-ribier.github.io/axeos-dashboard/en/installation.html)
of the user documentation.

Building the images yourself from local source instead of pulling the
prebuilt ones: see [`docker-build-dev.sh`](docker-build-dev.sh), documented
on the [Dev page](https://joakim-ribier.github.io/axeos-dashboard/en/dev.html).

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
