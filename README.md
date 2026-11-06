<p align="center">
  <img src="brand/icon.svg" alt="axeos-dashboard icon: a mining chip whose # closes into ₿" width="128">
</p>

# axeos-dashboard

📖 **[Documentation](https://joakim-ribier.github.io/axeos-dashboard/en/)** — supported models, tested firmware versions, full breakdown of every screen.

[![Checks](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/checks.yml)
[![Latest Release](https://github.com/joakim-ribier/axeos-dashboard/actions/workflows/latest.yml/badge.svg)](https://github.com/joakim-ribier/axeos-dashboard/releases/tag/latest)
[![Version](https://img.shields.io/github/v/release/joakim-ribier/axeos-dashboard?label=version)](https://github.com/joakim-ribier/axeos-dashboard/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)](server/go.mod)

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network.

Two Go binaries handle data collection and the REST API; a React SPA provides the UI. No authentication — internal LAN use only.

![axeos-dashboard home screen](docs/assets/images/dashboard-screenshot.png)

> [!TIP]
> **Easy to use** — one line, everything else configured from the UI:
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | IMAGE_TAG=latest bash
> ```

> [!NOTE]
> **Monitor your miners from anywhere** — push your stats to
> [hashboard.live](https://hashboard.live), free, no port to open or VPN to
> set up.

- [Prerequisites](#prerequisites)
- [Quick Start (dev)](#quick-start-dev)
- [Testing](#testing)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [AxeOs Device API](#axeos-device-api)
- [Icons](#icons)
- [License](#license)

---

## Prerequisites

The recommended setup (Docker, below) needs nothing but Docker itself
installed — no Go, Node, or nginx on the machine at all. See the
[Architecture page](https://joakim-ribier.github.io/axeos-dashboard/en/#architecture)
in the user documentation for how the feeder, dashboard API, mailer and
UI fit together.

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
make run-mailer        CONFIG=resources/dashboard.yml   # every mail (audit report, test mail)
make run-dashboard-ui  # Vite dev server on :5174, proxies /api → :8080
```

Or, for the UI work alone: `make run` -- dashboard-api and its UI in one
console, no feeder nor mailer, Ctrl+C stops both.

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
feeder/dashboard-api/mailer/remote-dashboard-api/rebuild-totals binaries for **both
`linux/arm64` (Raspberry Pi) and `linux/amd64` (typical VPS)**, builds the UI
once, and publishes everything to a rolling `latest` GitHub Release.
`make latest-update` auto-detects the local architecture (`uname -m`) and
pulls the matching binaries — no need to specify it manually, override with
`RELEASE_ARCH=` if detection ever guesses wrong.

- Pi: `make latest-update` — dashboard-api + feeder + mailer, in `dist/`, each
  a systemd service (`deploy/`, `make install-services`, `make restart`)
- VPS: the release's `remote-dashboard-api-amd64` and `ui-dist.tar.gz`, for a
  board

Neither needs a local Go or npm build.

**On your own server** — three values, the only ones to change. They're at the
very top of the [Makefile](Makefile); put yours in a `Makefile.local` next to
it, not versioned, which `make deploy` copies to the server too:

```makefile
DEPLOY_HOST := my-ssh-alias
DEPLOY_USER := me
DEPLOY_DIR  := /home/me/axeos-dashboard
```

| Variable | What it is |
|---|---|
| `DEPLOY_HOST` | The server's SSH alias |
| `DEPLOY_USER` | The user its services run as |
| `DEPLOY_DIR` | Its folder, holding `config.yml`, `settings.yml`, `miners.yml` and `data/` |

`deploy/` holds a template of each service and of the nginx site, with
`@DEPLOY_USER@` and `@DEPLOY_DIR@` in place of these values.

```bash
make deploy              # from your machine: dist/, deploy/ and the Makefile, nothing restarted

# on the server, in DEPLOY_DIR:
make install-services    # the first time, and when deploy/*.service change
make restart             # mailer, then feeder, then dashboard-api
```

nginx is yours to install, once: `dist/deploy/nginx-axeos-dashboard.conf`, with
your `DEPLOY_DIR` in place of `@DEPLOY_DIR@`.

Logs: `journalctl -u axeos-dashboard-feeder -f`, likewise for
`axeos-dashboard-api` and `axeos-dashboard-mailer`.

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

Browsable reference for both dashboard-api and remote-dashboard-api is in
the [API page](https://joakim-ribier.github.io/axeos-dashboard/en/api.html)
of the user documentation.

---

## AxeOs Device API

Full device API docs: https://osmu.wiki/bitaxe/api/

---

## Icons

The app's, the docs site's and [hashboard.live](https://hashboard.live)'s
icons all come from one pack, kept in [`brand/`](brand/) — what each file
is for and where it's used: [brand/README.md](brand/README.md).

---

## License

[MIT](LICENSE) © Joakim Ribier

---

<p align="center">
  <a href="https://badele.github.io/build-with-ai/"><img src="readme/build-with-ai.png" alt="Built with AI: spec human, code AI, review human-ish, tested on real Bitaxes" width="620"></a>
</p>
