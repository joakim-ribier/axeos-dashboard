# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Dashboard and controller for [Axeos Bitaxe](https://github.com/skot/ESP-Miner) Bitcoin ASIC miners. Two Go binaries + React SPA. Internal LAN tool — no auth.

Supported device models: **bitaxe** and **nerdaxe** (model-specific response parsing in `internal/healtcheck/response.go`).

## Commands

### Full Dev Stack

```bash
make dev-up        # start all 3 services in GNU screen session (axeos-dashboard)
make dev-down      # stop all
make dev-attach    # attach to screen session
make dev-logs      # tail logs
make dev-status    # check screen session status
```

### Individual Services

```bash
make run-dashboard-api CONFIG=resources/dashboard.yml   # HTTP API on :8080
make run-feeder        CONFIG=resources/dashboard.yml   # polling daemon
make run-dashboard-ui                                    # Vite dev server → :8080
make run-remote-dashboard-ui                                    # Vite dev server → :8081 (remote)
```

### Build & Lint

```bash
make build         # compile all binaries → resources/build/server/bin/
make lintAll       # golangci-lint on Go packages

cd ui && npm run lint        # ESLint
cd ui && npm run typecheck   # tsc --noEmit
cd ui && npm run format      # Prettier
cd ui && npm run clean:code  # typecheck + lint:fix + format (run before commit)

make swagger        # regenerate server/docs/swagger/ from handler annotations
                     # (run after touching a handler's @Summary/@Router/etc comments)
```

No tests exist yet.

## Architecture

### Data Flow

```
Bitaxe devices (HTTP)
    ↓  poll every 2m  (GET /api/system/info)
feeder → writes resources/data/bitaxes/{mac}/YYYY-MM-DD.jsonl  (append)
                                          {mac}/latest.json     (overwrite)
         optionally pushes to hashboard via POST /api/push (includes the
         already-computed storageKey -- hashboard just uses it verbatim,
         with no notion of MAC address formatting at all)
    ↓  reads latest.json
dashboard-api → REST API at /api/miners/*  (routes still take ip/hostname;
                config's mac: resolves the storage dir)
    ↓  axios + TanStack Query
React UI → display + control actions (MODE=local → :8080)
    ↓  POST/PUT
Bitaxe devices (restart / pool switch / WiFi)

remote-dashboard-api → REST API at /api/{boardId}/miners/*  (read-only, reads remote board data dir)
    ↓  axios + TanStack Query
React UI → display only (MODE=remote → :8081, route /{boardId})
```

Storage is keyed by each device's MAC address (`bitaxes: - mac:`), not its
IP: a device's IP can change (DHCP, relocation to a different network)
without losing its history, since the storage key stays the same. There's
no auto-discovery -- `mac:` is manually configured, same as `ip:`/
`hostname:`/`model:` (assumes you're already reserving/fixing each device's
IP on your network, which the rest of this config -- pool/wifi settings --
already requires anyway). IP is still how the feeder reaches a device over
the network and how dashboard-api's routes are addressed (`{hostnameOrIp}`)
-- it's just no longer the storage identity.

Both the feeder and the healthcheck watcher cross-check the configured
`mac:` against what the device itself reports on every poll. A mismatch
(wrong device at this IP, or a config typo) means the feeder refuses to
store that poll at all -- never writes into the wrong device's directory --
and the watcher flags it as `MinerInfo.error`, surfaced in the UI as a
distinct amber health indicator plus a `deviceError` notification (not
gated by a settings toggle, unlike temp/fan/offline).

### Storage Layout

```
resources/data/bitaxes/
  aabbccddee01/
    latest.json          ← overwritten each poll cycle
    2026-06-22.jsonl    ← append-only daily log
    2026-06-21.jsonl
  aabbccddee02/
  ...
```

### Go Backend (`server/`)

Three separate `cmd/` binaries sharing `internal/` packages:

| Package | Role |
|---|---|
| `cmd/feeder/` | Ticker loop: fetch device `/api/system/info`, append JSONL, write `latest.json`, push to hashboard |
| `cmd/dashboard-api/` | chi HTTP server; reads storage; proxies control commands to devices |
| `cmd/remote-dashboard-api/` | Read-only chi HTTP server; auto-discovers miners from remote board data dir; no watcher/cron |
| `internal/bitaxe/` | Raw HTTP client to device endpoints (`FetchSystemInfo`, `UpdateSystemStratumSettings`, `UpdateSystemWifiSettings`, `Restart`) |
| `internal/axeos/` | High-level orchestration: `SwitchPool()`, `SetWifi()`, `Restart()` — calls bitaxe client, optionally restarts after config change |
| `internal/storage/` | JSONL read/write, `latest.json` snapshot; JSONL reader tolerates malformed lines |
| `internal/poolscheduler/` | robfig/cron v3 jobs for timed pool switching (seconds precision, configured per-miner in YAML) |
| `internal/healtcheck/` | Periodic ping loop; `AxeOsModel` interface normalizes bitaxe vs nerdaxe response differences |
| `internal/config/` | YAML config loader; resolves `~` paths, provides `GetPoolsSettings()` for Primary/Fallback swap |
| `internal/model/` | `MinerInfo` (23 fields) / `MinersResponse` JSON types |
| `internal/handler/` | chi handlers; `toMinerInfo()` in `common.go` is single source of truth for unit conversions |

#### API Endpoints

| Method | Path | Handler | Notes |
|---|---|---|---|
| `GET` | `/api/miners/` | `ListMiners()` | Returns all miners + latest snapshot |
| `GET` | `/api/miners/{hostnameOrIp}/stats` | `Stats()` | Today's JSONL entries for one miner |
| `POST` | `/api/miners/{hostnameOrIp}/restart` | `Restart()` | Proxies restart to device |
| `PUT` | `/api/miners/pool/{primary\|fallback}/enable` | `SwitchPool()` | Switches stratum pool |
| `PUT` | `/api/miners/set/wifi` | `SetWifi()` | Updates WiFi credentials |

`MinerCtx` middleware resolves `hostnameOrIp` URL param → config entry, injects into request context.

Global middleware: RequestID, RealIP, Logger, Recoverer, Timeout(30s).

#### Unit Conversions (in `handler/common.go:toMinerInfo()`)

- Hash rate: GH/s (device) → TH/s (API) — divide by 1000
- Energy efficiency: Power (W) / HashRate (TH/s) = J/TH

#### MinerInfo Fields

23 fields including: timestamp, IP, MAC, hostname, model, hashrate (TH/s), power (W), efficiency (J/TH), pool URLs (main + fallback), temps (chip + VR), fan speed (RPM + %), uptime (seconds), shares (accepted/rejected), firmware version, response time, fallback flag.

### React Frontend (`ui/`)

Single page (`/`). MUI dark theme (bg `#1e1e2a`, primary `#00b4ff`). Fully localized (EN + FR via i18next).

#### Key Files

| File | Role |
|---|---|
| `src/App.tsx` | MUI theme, i18next, React Query provider, routing |
| `src/pages/Home.tsx` | Dashboard: `PageHeader` + `GlobalStats` + responsive grid of `MinerCard` (1/2/3 cols) |
| `src/components/ui/MinerCard/MinerCard.tsx` | Main card: hash rate, shares, temp, fan, pool, uptime, version; collapsible pool details + lazy-loaded stats chart |
| `src/components/ui/GlobalStats/GlobalStats.tsx` | Aggregated totals across all miners |
| `src/hooks/useMiners.ts` | TanStack Query: `GET /api/miners`, Zod validation, staleTime=Infinity |
| `src/hooks/useMinerActions.ts` | Local state (isExecuting, error); restart + pool switch mutations |
| `src/schemas/minerSchema.ts` | Zod schema validating API response |
| `src/utils/format.ts` | `formatMetric()` (K/M/G/T suffixes), `formatDuration()`, `formatTimestamp()` |

Charts: ApexCharts + Recharts (daily stats, lazy-loaded on first chart open). Validation: Zod. State: Zustand (present as dep, minimal current use in core flow).

Vite proxy: `API_PORT` env var required — `API_PORT=8080` (dashboard) or `API_PORT=8081` (remote-dashboard).
Route `/:boardId` → remote mode; route `/` → local mode.

### Config (`resources/dashboard.yml` + `resources/miners.yml`)

Two files, both read by both binaries -- `miners.yml` is always expected
right next to whatever `-config` file was loaded, no flag needed, nothing
to keep in sync between the two binaries. A `bitaxes:` block
written directly in `dashboard.yml` is **not** read. `-miners <path>` still
exists on the command line but is deprecated and ignored (logs a warning)
-- kept only so an older Makefile/script/systemd unit that still passes it
doesn't crash the binary outright.

```yaml
# dashboard.yml
global:
  env: dev                      # suppresses file logging (stdout only)
storage:
  dataDir: resources            # root dir -- app appends "data/bitaxes" itself, don't include it here
feeder:
  interval: 2m
healthCheck:
  interval: 1m
endpoints:
  timeout: 5s
  info: api/system/info
  system: api/system
  restart: api/system/restart
wifi:
  on: false
  ssid: ""
  pwd: ""
```

```yaml
# miners.yml -- gitignored; treated as managed data, generated/updated by
# the /settings page (network discovery + add-by-IP, and -- per miner,
# click its row to expand -- the pool scheduler editor) -- not meant to be
# hand-edited (a Settings save can overwrite it).
bitaxes:
  - ip: 192.168.1.65           # reserve/fix this via your router's DHCP so it never changes
    mac: aa:bb:cc:dd:ee:ff     # the device's real MAC, as-is -- separators optional, normalized automatically
    enabled: true
    hostname: my-miner
    model: bitaxe              # or: nerdaxe
    url: stratum.braiins.com
    port: 3333
    user: wallet.worker
    fallbackUrl: solo.atlaspool.io
    fallbackPort: 3333
    fallbackUser: wallet.worker
    poolSchedule:              # optional cron-based auto switching (seconds field included)
      - cron: "59 59 23 * * FRI"
        target: fallback
      - cron: "59 59 23 * * SUN"
        target: primary
```

Override dashboard-api/remote-dashboard-api port: `server.port` in the config YAML (default `8080`/`8081`) — no env var for this.
Override dashboard-api's data dir: `BITAXE_DATA_ROOT` env var (default from config's `storage.dataDir`).
Override remote-dashboard-api's data dir: `storage.boardsDir` in `remote-dashboard.yml` (no env var; defaults to `{dataDir}/data/boards`).

### Patterns & Constraints

- **No auth** — internal LAN only; no API keys, no CORS restrictions
- **Tests** — Go: stdlib `testing`/`httptest`; UI: Vitest + React Testing Library (see [readme/TESTING.md](readme/TESTING.md))
- **No WebSocket** — polling-based; feeder writes files, API reads files
- **Graceful shutdown** — both binaries handle SIGINT/SIGTERM
- **Error handling** — minimal custom types; `fmt.Errorf()` wrapping + structured logging (stdlib only)
- **Confirmation dialogs** — destructive actions (restart, pool switch) require user confirmation in UI

### Key Dependencies

**Go:** `go-chi/chi/v5`, `robfig/cron/v3`, `go.yaml.in/yaml/v3`

**React:** `@tanstack/react-query`, `@mui/material`, `axios`, `zod`, `i18next`, `apexcharts`, `recharts`, `zustand`
