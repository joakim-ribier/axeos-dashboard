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

Local dashboard and controller for [AxeOs](https://github.com/skot/ESP-Miner)-compatible Bitcoin ASIC miners — designed to run on a Raspberry Pi or any machine on your local network. No authentication: LAN use only.

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
- [Makefile](#makefile)
- [Testing](#testing)
- [Releases](#releases)
- [Deployment](#deployment)
- [API](#api)
- [Icons](#icons)
- [License](#license)

---

## Prerequisites

The Docker install needs Docker only. Development, or building the images
yourself, needs Go and Node:

```bash
apt install -y golang nodejs npm
```

How the feeder, dashboard-api, mailer and UI fit together: the
[Architecture page](https://joakim-ribier.github.io/axeos-dashboard/en/#architecture).

---

## Makefile

`make` alone lists every command, by where it runs:

![make's output: every command, by section and where it runs](readme/make-help.png)

Details: the [Makefile page](https://joakim-ribier.github.io/axeos-dashboard/en/makefile.html). `dashboard.yml`'s
fields: the [Installation page](https://joakim-ribier.github.io/axeos-dashboard/en/installation.html#config-file).

---

## Testing

```bash
make test               # Go -- standard library only (testing, httptest)
cd ui && npm run test   # UI -- Vitest + React Testing Library; npm run test:watch to watch
```

Every push to `main` and every pull request targeting it runs
[`checks.yml`](.github/workflows/checks.yml):

| Job | Steps |
|-----|-------|
| `go` | `go vet` → `golangci-lint` → `go test -race -cover` |
| `ui` | `npm run typecheck` → `npm run lint` → `npm run test` |

---

## Releases

When `checks.yml` succeeds on `main`, [`latest.yml`](.github/workflows/latest.yml)
builds every binary for `linux/arm64` (Raspberry Pi) and `linux/amd64` (VPS),
and the UI, into a rolling `latest` GitHub Release.

`make latest-update` installs it on the server.
A board's VPS takes the release's `remote-dashboard-api-amd64` and
`ui-dist.tar.gz`.

---

## Deployment

**With Docker** — the [Installation page](https://joakim-ribier.github.io/axeos-dashboard/en/installation.html): install,
fixed port, updating, pinning a version with `IMAGE_TAG`. `make docker`
builds the images from your checkout: the [Dev page](https://joakim-ribier.github.io/axeos-dashboard/en/dev.html).

**On your own server**, from a local build:

```bash
make init                # your machine: the server's SSH alias, user and folder, into Makefile.local
make deploy              # your machine: the binaries, the UI, deploy/ and the Makefile onto the server

# on the server, in its folder:
make install-services    # the first time, and when deploy/*.service change -- with the axeos-* shortcuts
make restart
```

nginx, once: `dist/deploy/nginx-axeos-dashboard.conf`, with your folder in
place of `@DEPLOY_DIR@`. Logs: `axeos-logs`.

---

## API

- This dashboard's (dashboard-api, remote-dashboard-api): the [API page](https://joakim-ribier.github.io/axeos-dashboard/en/api.html)
- The miners' (AxeOS): https://osmu.wiki/bitaxe/api/

---

## Icons

One pack for the app, the docs and [hashboard.live](https://hashboard.live):
[`brand/`](brand/README.md).

---

## License

[MIT](LICENSE) © Joakim Ribier

---

<p align="center">
  <a href="https://badele.github.io/build-with-ai/"><img src="readme/build-with-ai.png" alt="Built with AI: spec human, code AI, review human-ish, tested on real Bitaxes" width="620"></a>
</p>
