# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Dashboard and controller for [Axeos Bitaxe](https://github.com/skot/ESP-Miner) Bitcoin ASIC miners. Two Go binaries + React SPA. Internal LAN tool — no auth.

Supported device models: **bitaxe** and **nerdaxe** (model-specific response parsing in `internal/healtcheck/response.go`).

Naming: **board** is the word of the remote side -- what a board owns or reads is `boardX` (`boardSettings`, `BoardLayout`), not `RemoteBoardX`, nor a bare `RemoteX` that would read like `config.RemoteConfig`, the local dashboard's own `remote` settings.

## Commands

`make` alone lists every target, by section -- the README shows it as an image: with any new, renamed or redescribed target, regenerate it with `freeze --execute "make" --window --border.radius 8 --shadow.blur 20 --shadow.y 10 --margin 20 --padding 20,40 --output readme/make-help.png` (then `sips -Z 2400` it).

### Dev

```bash
make run                                                 # the whole stack in this console: mailer, feeder, dashboard-api, UI (:5174) -- each line
                                                         # prefixed with its process, Ctrl+C stops it all
make run-dashboard-api CONFIG=resources/dashboard.yml   # one service alone, from the last build: HTTP API on :8080
make run-feeder        CONFIG=resources/dashboard.yml   # polling daemon
make run-mailer        CONFIG=resources/dashboard.yml   # every mail
make run-dashboard-ui                                    # Vite dev server → :8080
make docker                                              # the Docker images from this checkout, then the stack (docker-build-dev.sh, HTTP_PORT=)
make rebuild-totals                                      # totals.json from the history, dry run unless DRY_RUN=
```

### Deploy

```bash
make deploy            # from your machine: a local build into dist/ on DEPLOY_HOST, nothing restarted
make install-services  # on the server: the systemd services from deploy/, the first time and when they change
make restart           # on the server: mailer, then feeder, then dashboard-api
make update            # on the server: from the last vX.Y.Z release, restarted (RELEASE_TAG=1.0.0 / latest for another) -- with the release's Makefile and deploy/
make versions          # the releases on GitHub: latest's commit, every vX.Y.Z
```

On the server, `deploy/aliases.sh` (in `dist/deploy/`, loaded from `~/.bashrc`): `axeos-restart`, `axeos-update`, `axeos-status`, `axeos-logs`.

The server's values are at the very top of the Makefile (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_DIR`), yours in `Makefile.local`, not versioned -- `make init` writes it, asking for each.

### Build & Lint

```bash
make build         # compile all binaries → resources/build/server/bin/
make lint          # golangci-lint on Go packages -- requires golangci-lint v2.13.1 installed
                   # locally (e.g. `brew install golangci-lint`), same version CI pins in
                   # .github/workflows/checks.yml -- keep both in sync when bumping

cd ui && npm run lint        # ESLint
cd ui && npm run typecheck   # tsc --noEmit
cd ui && npm run format      # Prettier
cd ui && npm run clean:code  # typecheck + lint:fix + format (run before commit)

make swagger        # regenerate server/docs/swagger/ from handler annotations, and copy
                     # the generated swagger.json into docs/assets/api/ (feeds the docs
                     # site's Redoc page, docs/en/api.md) -- run after touching a handler's
                     # @Summary/@Router/etc comments. Each route's @Tags is its domain
                     # (Miners, Audit, Configuration...); the tags and their service groups
                     # (x-tagGroups: dashboard-api / remote-dashboard-api / mailer) are
                     # declared in cmd/dashboard-api/main.go -- a new tag goes in both
```

## Architecture

### Data Flow

```
Bitaxe devices (HTTP)
    ↓  poll every 2m  (GET /api/system/info)
feeder → writes resources/data/bitaxes/{mac}/YYYY-MM-DD.jsonl  (append)
                                          {mac}/latest.json     (overwrite)
         optionally pushes to hashboard via POST /api/push (includes the
         already-computed storageKey -- hashboard just uses it verbatim,
         with no notion of MAC address formatting at all) and totals to
         POST /api/push/totals; an offline poll goes to POST
         /api/push/history instead (appended to the day there, latest.json
         untouched -- same as locally), so a remote board's 24h chart dips
         like the local one. Stats only: no alerts, no config (miners.yml/
         settings.yml), nothing of a MAC mismatch -- each sample carries
         just what the board shows it by (alias, rate, feeder interval, the
         miner's alert thresholds); only the first enabled miners, in the
         config's order, up to the board's miner limit (hashboard's
         /api/board/info, read again in the background each cycle --
         remotepush.Split), the others polled and stored here as usual
    ↓  reads latest.json
dashboard-api → REST API at /api/miners/*  (routes still take ip/hostname;
                config's mac: resolves the storage dir)
    ↓  axios + TanStack Query
React UI → display + control actions (MODE=local → :8080)
    ↓  POST/PUT
Bitaxe devices (restart / pool switch)

remote-dashboard-api → REST API at /api/{boardId}/miners/*  (reads remote board data dir)
    ↓  axios + TanStack Query
React UI → the home page alone (MODE=remote → :8081, route /{boardId})

Remote actions (a private board's owner: restart / pool switch)
feeder → POST hashboard /api/push/settings (the actions allowed + the poll
    interval, when they change) → boards/{boardId}/settings.json -- the
    board's own settings, not a miner's
React UI (board) → POST remote-dashboard-api → boards/{boardId}/actions/{mac}.json
dashboard-api (every minute, only while Configuration › Remote allows one)
    → GET hashboard /api/actions/pending → {mac}.state.json ({id, polledAt}), written
      by hashboard → does it (axeos, audited, mailed) -- nothing reported back
GET /miners → the board shows the request in progress: "pending" then "polled"
```

The UI only ever talks to its own API -- dashboard-api, or remote-dashboard-api
on a board -- never to hashboard; only the local backends (feeder,
dashboard-api) call hashboard.

Storage is keyed by each device's MAC address (`bitaxes: - mac:`), not its
IP: a device's IP can change (DHCP, relocation to a different network)
without losing its history, since the storage key stays the same. There's
no auto-discovery -- `mac:` is manually configured, same as `ip:`/
`hostname:`/`model:` (assumes you're already reserving/fixing each device's
IP on your network, which the rest of this config -- pool settings --
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
    alerts.json          ← its alerts in progress (feeder), kept between polls
    2026-06-22.jsonl    ← append-only daily log
    2026-06-21.jsonl
  aabbccddee02/
  ...
resources/data/backups/
  2026-09.zip           ← one per month, the feeder adds each completed (UTC)
                          day to it: data/bitaxes/{mac}/*.jsonl only -- unzip
                          into storage.dataDir to restore
  checksums.md5         ← MD5 of each past month's archive, written once it's
                          complete -- a month listed here is final, never
                          opened or rewritten again
resources/data/audit/
  2026-06-22.jsonl      ← append-only audit log (dashboard-api), one per UTC day
resources/data/alerts/
  2026-06-22.jsonl      ← append-only alerts log (feeder), one per UTC day:
                          only changes of state, raised / cleared
```

### Go Backend (`server/`)

Separate `cmd/` binaries sharing `internal/` packages:

| Package | Role |
|---|---|
| `cmd/feeder/` | Ticker loop: fetch device `/api/system/info`, append JSONL, write `latest.json`, track alerts (`internal/alerts`), push to hashboard, hand the poll's new alerts to the mailer in the background (when `notifications.alerts.mail` is on); hourly, add any completed day not yet backed up to its month's archive |
| `cmd/dashboard-api/` | chi HTTP server; reads storage; proxies control commands to devices |
| `cmd/mailer/` | Every mail, and the only SMTP code: every minute, sends the audit report once due (`auditreport.Due`), from the audit log and `settings.yml` on disk, and the alerts mail the feeder hands it after a poll (`POST /api/mailer/alerts`: the alerts it raised, one HTML mail -- `alertmail`), and the remote action mail dashboard-api hands it (`POST /api/mailer/remote-action` -- `remoteactionmail`, failures only logged); its test route also sends an example of the alerts mail, of the audit report or of the remote action mail (`kind: "alert"` / `"audit"` / `"remote"`, made-up content); its own API on the loopback (`mailer.port`, default 8082) -- `GET /api/mailer/status`, `POST /api/mailer/test` -- which dashboard-api relays (`handler/mailer.go`), so a test mail that goes out proves the mailer runs; its own process so a slow SMTP server touches neither polling nor the UI; exits if its port is taken (another mailer would send every report twice) |
| `cmd/remote-dashboard-api/` | chi HTTP server for the board UI; auto-discovers miners from remote board data dir; no watcher/cron; its one write: creating a private board's action request (`handler/remote_actions.go`, `boards/{boardId}/actions/{mac}.json`, one per miner, replaced by its next request -- hashboard alone writes its state) |
| `internal/remoteactions/` | What a private board's owner asks for (restart, switch_primary, switch_fallback): `Poller`, started by dashboard-api, asks hashboard every minute (`GET /api/actions/pending`) -- only while `remote.actions` allows one, no request otherwise -- checks each request (still allowed, an enabled miner of ours by MAC), does it like the UI's buttons (`axeos.Restart` / `ActivateSlot`), audits it (`system` / `remote`, with the IP and User-Agent it was asked from), and hands the mailer the mail when `remote.actions.mail` is on -- nothing is reported back to hashboard. Hashboard isn't trusted: nothing it sends is an address or a pool (the miner and its pools come from the local config, the action from a fixed list), its response is bounded (1 MiB), the requester's IP/User-Agent too (256), and a miner takes one action per 2 poll intervals, whatever comes in; `Interval` (a minute) goes to the board with its settings, whose delays are made of it; `Action`/`State` mirror hashboard's files, a cross-repo contract |
| `internal/remoteactionmail/` | The remote action mail: `Build` (the templates `remote-action.*.html` and `.txt` filled + the logo inline -- all the wording is in them, labels in `{{define}}`, none in Go) -- the miner's name and the outcome only, no IP nor error |
| `internal/bitaxe/` | Raw HTTP client to device endpoints (`FetchSystemInfo`, `UpdateSystemStratumSettings`, `Restart`) |
| `internal/axeos/` | High-level orchestration: `SwitchPool()` (pools from `miners.yml` -- the scheduler), `ActivateSlot()` (a switch from the UI: the device's own slots, read now, with `Activating` -- the miner, not `miners.yml`, is the truth there), `SwitchToPool()` (a pool picked by URL + port, whichever slot the device holds it in: `useFallbackStratum` on a bitaxe, the primary slot on a nerdaxe), `ReadPools()` (a device's pools, read now), `Restart()` — calls bitaxe client, always restarts to apply a config change; a restart left unanswered after the new pools were taken counts as done (the miner is already rebooting) |
| `internal/audit/` | Audit log: every user-triggered action that matters -- restart, pool switch, `miners.yml`/`settings.yml` save, audit export, backups download, network discovery -- plus their own types with before/after for security-relevant config changes (`changes.go`: pool, schedule, IP, enable/disable, added miner, remote push) -- via `Log.Middleware` (`middleware.go`), set per route by the router's `audited(type)` (client IP/User-Agent, status, query string, error message), never the UI's polling reads, and every scheduler run -- one JSONL file per UTC day under `{dataDir}/data/audit/`; `ReadRange` backs `GET /api/audit` |
| `internal/alerts/` | Alerts, edge-triggered: `MinerState.Observe` compares each poll with the miner's alerts in progress (`{mac}/alerts.json`: `Ongoing`, the event that raised each, with its `Peak` kept up to date -- sent on the cleared event) and returns only the changes -- raised once when one starts, cleared once when it ends (with `raisedAt`). Hysteresis: raised above the miner's thresholds (`config.AlertThresholdsFor`: its own in `miners.yml`, else `settings.yml`'s, else 62 °C / 75 %), cleared under the threshold minus `settings.yml`'s margins (`config.AlertMargins`, common to every miner, else 2 °C / 5 % -- `ClearLevel`, also what the API sends as `clearBelow`); offline after 2 failed polls in a row; `Log` -- one JSONL file per UTC day under `{dataDir}/data/alerts/` -- backs `GET /api/miners/alerts(/history)` |
| `internal/auditreport/` | The audit report mail: `Due` (sent around 1 a.m. UTC -- UTC days, like the audit's own files -- daily / every 2 days / weekly Mon→Sun / monthly, each covering the period since the previous one), `Build` (grouped by type, FR/EN -- its labels mirror `ui/src/locales` `auditPage.*` -- the HTML template `audit-report.*.html` filled + a generated text version + the logo inline, the link to the Audit page only for a dashboard with a name: `mailtemplate.Linkable`), `State` on disk (`data/mail/audit-report.json`: last period sent, last error, hourly retry) |
| `internal/alertmail/` | The alerts mail: `Build` (the HTML template filled + a generated text version + the logo inline), `State` on disk (`data/mail/alerts-mail.json`: last sent, last error, for the Notifications page); a failure is audited (`alert_mail`), a mail sent isn't, nothing is retried |
| `internal/mailtemplate/` | The mails' wording, as editable files: built-in ones embedded, one per mail and language (`alert.*.html`, `audit-report.*.html` and `remote-action.*.html`, Go `html/template`s whose `<title>` is the subject, see `RenderHTML` -- never an IP address in them, Gmail files that as spam; `test-mail.*.txt`, plain text), installed by the mailer into `mail-templates/` next to the config file when missing (never over an edited one), read again on every send; `Subject:` line + blank line + text, `#` comments, `{{name}}` placeholders -- a line whose placeholder is empty is dropped, an unknown one kept as is; a broken file falls back to the built-in template (logged) |
| `internal/mail/` | SMTP sending, standard library only (`Send`: STARTTLS / TLS / plain, optional auth, 15s timeout, UTF-8 headers; with `HTML`, a multipart/alternative text + HTML, inline images by Content-ID); `mailtest` is a fake SMTP server for tests |
| `internal/backup/` | Monthly zip archives (`ArchiveCompletedDays`, `List`, `Merge`); a past month becomes final once its MD5 is in `checksums.md5` |
| `internal/storage/` | JSONL read/write, `latest.json` snapshot; JSONL reader tolerates malformed lines |
| `internal/scheduler/` | robfig/cron v3 jobs for timed per-miner actions -- switch primary, switch fallback, or restart (seconds precision, configured per-miner in YAML) |
| `internal/healtcheck/` | Periodic ping loop; `AxeOsModel` interface normalizes bitaxe vs nerdaxe response differences |
| `internal/config/` | YAML config loader; resolves `~` paths, provides `GetPoolsSettings()` (a scheduled switch's PATCH, from the pools saved in `miners.yml`); a miner's two pools are `Slot`s (`Pool` = URL + port, plus the user): `BitaxeServerSettings.Primary()/Fallback()/Slot()/Holding()` (`ErrPoolNotHeld` when a pool is in neither slot), and `Activating(model, target)` -- the PATCH that makes target's pool the active one, for each model: `useFallbackStratum` on a bitaxe, the pool in the primary slot on a nerdaxe (every switch goes through it: scheduled, from the UI, the fleet's); `Bitaxe.Slots()/WithSlots()` read/replace its saved ones; a device's `/api/system/info` is read with `ParseMinerPools(model)`, which returns its `DevicePools` (pools + MAC, shared, also what discovery decodes) and its active slot -- decoded as `BitaxePools`/`NerdaxePools`, which extend `DevicePools`, each telling its `Active()` slot its own way -- never into `BitaxeServerSettings`, whose `useFallbackStratum` bool fails on a bitaxe's 0/1; `MinersStore`/`AppSettingsStore` (`live.go`) are the mtime-based hot-reload stores shared by dashboard-api and feeder for `miners.yml`/`settings.yml`; `defaults.go` holds the built-in pool-dashboard/firmware-repo registries, merged with `settings.yml`'s overrides on every load (`mergePoolDashboards`/`mergeFirmwareRepos`) |
| `internal/model/` | `MinerInfo` (43 fields) / `MinersResponse` JSON types |
| `internal/handler/` | chi handlers; `toMinerInfo()` in `common.go` is single source of truth for unit conversions; `config.go` also serves `/api/config/miners` and `/api/config/settings` (read/write the two managed YAML files) |

#### API Endpoints

Full, always-current list: `make swagger` output, or the generated
[API page](https://joakim-ribier.github.io/axeos-dashboard/en/api.html) --
this table is a curated summary, not the source of truth.

dashboard-api (`server/cmd/dashboard-api/router.go`):

| Method | Path | Handler | Notes |
|---|---|---|---|
| `GET` | `/api/info` | `Info()` | Build/version info |
| `GET` | `/api/miners` | `ListMiners()` | All miners + latest snapshot |
| `GET` | `/api/miners/alerts` | `ListAlerts()` | Most recent alert changes (raised / cleared) across miners, and `seenAt` -- the bell |
| `GET` | `/api/miners/alerts/active` | `ListActiveAlerts()` | Alerts in progress on enabled miners, however old; every alerts list is sorted date desc → type (`alerts.Types` order, most serious first: offline, macMismatch, tempHigh, fanHigh, firmwareUpdate) → MAC (each miner's `alerts.json`), each with the level it ends under (`clearBelow`) -- the Alerts page's top section and the sidebar's badge |
| `POST` | `/api/miners/alerts/seen` | `MarkAlertsSeen()` | Marks the alerts read up to `seenAt` (`data/alerts/seen.json`, never moves back) -- for every browser |
| `GET` | `/api/miners/alerts/history` | `ListAlertsHistory()` | One UTC day's alert changes, paginated, `ip`/`type` filters -- the Alerts page |
| `GET` | `/api/miners/history` | `History()` | Last 24h of every miner's hashrate, in 96 buckets of 15 min (0 = offline, null = no reading) |
| `GET` | `/api/miners/{hostnameOrIp}/stats` | `Stats()` | Last 24h (rolling) of JSONL entries for one miner |
| `POST` | `/api/miners/{hostnameOrIp}/restart` | `Restart()` | Proxies restart to device |
| `PUT` | `/api/miners/pool/{primary\|fallback}/enable` | `SwitchPool()` | Switches miner(s) to their primary / fallback slot as each device holds it right now (`axeos.ActivateSlot`) -- one `switch_primary`/`switch_fallback` audit entry per miner, with the pool it left and the one it joined |
| `PUT` | `/api/miners/pool/switch?url=&port=` | `SwitchToPool()` | Switches every enabled miner holding this pool, in either slot, to it, all at once -- one already on it or without it is left alone; per-miner result, one `switch_pool` audit entry per miner it sent something to (Configuration › Mineurs › Actions) |
| `GET` | `/api/config/miners` | `ListMinersConfig()` | Read `miners.yml` |
| `GET` | `/api/config/miners/sync` | `MinersSync()` | Reads every enabled miner's pools off the device, now (MAC checked), and how `miners.yml` differs, slot by slot -- with the entries to POST to sync it; writes nothing, not audited (Actions › Vérifier les pools) |
| `POST` | `/api/config/miners` | `SaveMinersConfig()` | Write `miners.yml` (Settings page) |
| `GET` | `/api/config/settings` | `GetAppSettings()` | Read `settings.yml` (merged with defaults) |
| `POST` | `/api/config/settings` | `SaveAppSettings()` | Write `settings.yml` |
| `GET` | `/api/config/discover` | `Discover()` | Network scan for AxeOS devices |
| `POST` | `/api/config/mail/test` | `SendTestMail()` | Has the mailer send a test mail to the recipients through the **saved** SMTP server (`lang`: fr/en); 503 when the mailer isn't running |
| `GET` | `/api/status` | `Status()` | How every process is doing, in one answer: dashboard-api, feeder (its last poll, from `latest.json`), health check, mailer (asked on the loopback), firmware cache -- each `ok` / `late` (nothing within twice its interval) / `offline` (didn't answer) / `unknown` (no run yet); the sidebar's services dots |
| `GET` | `/api/remote/board` | `RemoteBoard()` | The hashboard board this instance pushes to (boardId, public, links, last sample received) -- relays hashboard's `GET /api/board/info`, cached one feeder interval (`remotepush.BoardCache`); its miner limit, and the enabled miners the feeder holds back past it (`notSent`, `remotepush.Split`), and the link's `state` (ok / unauthorized: the key is refused / refused: 429 / unreachable -- `remotepush.StateOf`); empty when remote isn't configured |
| `GET` | `/api/audit` | `ListAudit()` | Audit log between `from`/`to` (default last 24h, max a year): restart, pool switch, config saves, exports/downloads, network discovery -- API with client IP/User-Agent, system (scheduler); `ip`/`type` filters -- paginated (+ `/api/audit/export`, same filters, unpaginated JSON file; `/api/audit/types`, the list of types -- `audit.Types`, the one source the UI's filter reads) |
| `GET` | `/api/backups` | `ListBackups()` | Monthly backup archives |
| `GET` | `/api/backups/download?months=` | `DownloadBackups()` | One or several months in one zip |

`MinerCtx` middleware resolves `hostnameOrIp` URL param → config entry, injects into request context.

remote-dashboard-api (`server/cmd/remote-dashboard-api/router.go`), all under `/api/{boardId}/`:

| Method | Path | Handler | Notes |
|---|---|---|---|
| `GET` | `/api/info` | `Info()` | Build/version info |
| `GET` | `/api/{boardId}/miners` | `ListRemoteMiners()` | Miners pushed to this board |
| `GET` | `/api/{boardId}/miners/history` | `RemoteHistory()` | Last 24h of every remote miner's hashrate, same buckets as local |
| `GET` | `/api/{boardId}/{ip}/stats` | `RemoteStats()` | Last 24h (rolling) of stats for one remote miner |
| `POST` | `/api/{boardId}/miners/{ip}/actions` | `RequestRemoteAction()` | Private board only (its viewer is its owner): asks for an action the board's `settings.json` allows, on a miner still sending data -- one in progress per miner, 10 per board an hour |

`GET /miners` carries each miner's `remoteActions` -- the board's
`settings.json` (`remote.actions`, in `settings.yml`'s sections), which the feeder pushes when it changes
(`POST /api/push/settings`, tried again next cycle on a failure) -- on a
private board only, and only for a miner still sending data (its dashboard
may be off otherwise): the board UI shows a button only for those. And its
`remoteAction`, the request in progress: `pending` until hashboard hands it
out (`polledAt`), then `polled` -- each for 2 poll intervals at most
(`remote.pollIntervalSeconds`): past that a pending one expired, never handed
out, and a polled one is over. The buttons stay greyed out meanwhile.

Global middleware: RequestID, RealIP, Logger, Recoverer, Timeout(30s).

#### Unit Conversions (in `handler/common.go:toMinerInfo()`)

- Hash rate: GH/s (device) → TH/s (API) — divide by 1000
- Energy efficiency: Power (W) / HashRate (TH/s) = J/TH

#### MinerInfo Fields

43 fields including: timestamp, IP, MAC, hostname, alias (display-name override), model, hashrate (TH/s), power (W), efficiency (J/TH), pool URLs + ports (main + fallback), temps (chip + VR), fan speed (RPM + %), uptime (seconds), shares (accepted/rejected), persistent totals (including cumulative electricity cost), firmware version, response time, fallback flag, electricity rate, alerts in progress (`activeAlerts`: type + `clearBelow`, from the feeder's `alerts.json` -- always a list locally, null on a board).

### React Frontend (`ui/`)

Pages: Home (`/`), Alerts, Audit, Settings, Backups. A board (`/{boardId}`, remote mode) is the Home page alone -- `BoardLayout`: no sidebar nor top bar, an icon in the fleet card's header (`BoardPanelButton`, through `BoardPanelContext`) opening `BoardPanel` (the board, what's shared -- read off the latest samples, `sharedOnBoard` -- and the version), the browser's language; any other path under it lands on its home. MUI dark theme (bg `#1e1e2a`, primary `#00b4ff`). Fully localized (EN + FR via i18next).

Every page declares its title with `PageHeader`, which renders into the sticky `TopBar` (a portal into a slot `AppLayout` provides) rather than above the page; on a phone the bar keeps the title, auto-refresh and the bell, the rest unfolds under a "More" button.

#### Key Files

| File | Role |
|---|---|
| `src/App.tsx` | MUI theme, i18next, React Query provider, routing |
| `src/pages/Home.tsx` | Dashboard: `FleetSummary` + status/pool `BreakdownStrip`s (also quick filters) + `MinerToolbar` + `MinerList`/`MinerTiles` + `MinerDrawer` |
| `src/components/layout/` | `AppLayout` (local) / `BoardLayout` (a board) -- the one place local vs. board is decided, each wraps its pages in `ModeProvider` (API paths); `Sidebar`, sticky `TopBar` (holds the page title slot, `pageTitleSlot.ts`; its sync icon is the auto-refresh switch), `ServicesStatus` (the sidebar's "Platform status" card -- green / orange when a service missed a run / red when one doesn't answer -- and its details window, from `GET /api/status`, local mode only) |
| `src/components/dashboard/fleet/` | 24h fleet hashrate chart, health badge (unfolds every miner, problems first), KPIs |
| `src/components/dashboard/miners/` | Dense list rows and tiles: 24h sparkline, temp/fan gauges, active pool link |
| `src/components/dashboard/drawer/` | Per-miner detail panel: issues, vitals, 24h chart, pools, session/all-time/device, restart + pool switch |
| `src/pages/settings/` | Configuration: one section at a time, picked from `SectionMenu` (a column, `SectionPicker` folded on a phone); a configured miner opens `MinerConfigPanel` -- the same menu over its sections (name, pool, alert thresholds, scheduler), each editor saving on its own |
| `src/components/ui/` | The shared pieces every page reuses rather than restyles: `SectionLayout` (`PAGE_GAP` 32px between a page's blocks, `SECTION_GAP` 20px within one, `ROW_SPACING`, `SectionStack`/`SectionActions` -- buttons under the fields, full width on a phone), `SectionMenu`, `SidePanel` (the right-hand panel, swipe to close), `ActionButton`, `RowList`/`Row` (a list on a phone), `UrlText` (a URL on one line, whole on hover), `DeviceLink`, `AlertThresholdsForm` |
| `src/utils/minerStatus.ts` | Status per miner, most urgent first: offline > configError > stale > warning (temp / fan alert in progress -- `activeAlerts` from `/api/miners`, so the hysteresis matches the Alerts page; a board, which has none, falls back to above the thresholds pushed with each sample, 62 / 75 when absent) > ok |
| `src/hooks/useMiners.ts` | TanStack Query: `GET /api/miners`, Zod validation, staleTime=Infinity |
| `src/hooks/useMinersHistory.ts` | `GET /api/miners/history` -- the fleet chart and every sparkline |
| `src/hooks/useMinerActions.ts` | Local state (isExecuting, error); restart + pool switch mutations |
| `src/schemas/minerSchema.ts` | Zod schema validating API response |
| `src/utils/format.ts` | `formatMetric()` (K/M/G/T suffixes), `formatDuration()`, `formatTimestamp()` |

Charts: Recharts (fleet chart, per-miner 24h chart) plus a hand-drawn SVG sparkline. Validation: Zod. State: TanStack Query for server data, React state and contexts (`src/contexts/`) otherwise.

Vite proxy: `API_PORT` env var required — `API_PORT=8080` (dashboard) or `API_PORT=8081` (remote-dashboard). Running a board locally (`make run-dashboard`), like deploying one, is on the hashboard side.
Route `/:boardId` → remote mode; route `/` → local mode.

### Config (`resources/dashboard.yml` + `resources/settings.yml` + `resources/miners.yml`)

Three files, all read by both binaries -- `settings.yml` and
`miners.yml` are always expected right next to whatever `-config` file was
loaded (override via `appSettingsFile:` in `dashboard.yml` if you want
`settings.yml` elsewhere -- `miners.yml`'s location can't be overridden,
see PR #3), no flag needed, nothing to keep in sync between the two
binaries. `dashboard.yml` holds process-launch settings (read once
at startup, no hot-reload -- shown read-only on `/settings`); electricity
rate and remote push credentials live in `settings.yml` instead,
editable from `/settings` without a restart. A `bitaxes:` block
written directly in `dashboard.yml` is **not** read. `-miners <path>`
still exists on the command line but is deprecated and ignored (logs a
warning) -- kept only so an older Makefile/script/systemd unit that still
passes it doesn't crash the binary outright.

Pool dashboard links and firmware repo URLs are **not** config at all in
the usual sense: they're built into the binary (`internal/config/defaults.go`
-- `DefaultPoolDashboards`, `DefaultFirmwareRepos`), so a new pool or a
fixed repo URL ships in a release rather than requiring every deployment
to edit YAML. `settings.yml`'s `pools.dashboards`/`firmware.repos`
carry **overrides only** (an extra pool, or a per-model repo URL to use
instead of the built-in one) -- the effective map every consumer reads
(`Config.Pools.Dashboards`/`Config.Firmware.Repos`) is always defaults
merged with these overrides, recomputed on every load/reload so a removed
override actually falls back to the built-in value. `/settings` only
exposes the `pools.dashboards` half of this (add/remove a custom pool);
`firmware.repos` shows as a frozen, read-only table there -- an override
for it only happens by hand-editing `settings.yml` directly.

```yaml
# dashboard.yml
global:
  env: dev                      # suppresses file logging (stdout only)
# appSettingsFile: /path/to/settings.yml   # optional -- defaults to settings.yml next to this file
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
firmware:
  cacheTTL: 24h                 # repos: not set here -- built-in defaults, see internal/config/defaults.go
# electricity / remote: see settings.yml -- only used from here as
# initial values the first time settings.yml doesn't exist yet.
```

```yaml
# settings.yml -- gitignored; treated as managed data, generated/updated
# by the /settings page's "App settings" section. Applies to dashboard-api
# immediately and to the feeder on its next poll cycle, no restart needed.
electricity:
  ratePerKwh: 0.1915
  devices:                      # optional non-miner consumers (fan, router...), constant draw in W --
    - name: Extractor fan       # only added to the miners' power for the Electricity card's estimated
      power: 30                 # cost per day; nothing is stored or accumulated
pools:
  dashboards:
    # extra pool(s), or an override for a built-in one -- see defaults.go
    myprivatepool.example.com: "https://myprivatepool.example.com/u/{user}"
firmware:
  repos:
    # only set the model(s) you actually want to override
    bitaxe: "https://api.github.com/repos/myfork/esp-miner/releases/latest"
remote:
  pushURL: ""
  apiKey: ""
  sendUser: false               # push the stratum users (wallet) -- off by default: pushed as "xxxxxxxx"
  sendPools: false              # push the pools (url/port) -- off by default: "xxxxxxxx"/0; ssid/ipv6 always obfuscated
  sendIP: false                 # push the miners' IPs -- off by default: the board then knows each by fd00::<mac> (aabb:ccdd:eeff)
  actions:                      # what a private board's owner may ask for from the board -- all off by default;
    restart: false              # while one is on, dashboard-api asks hashboard every minute (never otherwise)
    switchPool: false           # switch_primary / switch_fallback, the pools the device already holds
    mail: false                 # a mail on every remote action, done or not
notifications:                  # Configuration > Notifications; never pushed to hashboard
  language: fr                  # fr | en -- the messages' language
  dashboardURL: http://192.168.1.60   # the dashboard's own address, for the messages' links
  mail:                         # the mail channel
    smtp:
      host: smtp.example.com    # empty = mail off (clearing it drops the whole smtp block)
      port: 587
      security: starttls        # starttls | tls | none
      username: axeos
      password: ""              # write-only: GET /api/config/settings only says passwordSet;
                                # a save without one keeps the stored one
      from: axeos@example.com
    to: [me@example.com]
  auditReport:                  # sent by the mailer around 1 a.m. UTC; UTC days, like the audit's
    enabled: true
    frequency: weekly           # daily | every2days | weekly | monthly
    types: []                   # empty = every audit type
    skipIfEmpty: true
  alerts:
    mail: true                  # one mail per feeder poll that raises alerts (the feeder calls the mailer)
alerts:                         # Configuration > System: the thresholds every miner follows unless it has its own
  tempHigh: 62                  # °C -- unset (0) = the built-in 62
  fanHigh: 75                   # %  -- unset (0) = the built-in 75
  tempMargin: 2                 # °C -- an alert ends under threshold - margin; unset (0) = 2, common to every miner
  fanMargin: 5                  # %  -- same, unset (0) = 5
```

```yaml
# miners.yml -- gitignored; treated as managed data, generated/updated by
# the /settings page (network discovery + add-by-IP, and -- per miner,
# click its row to expand -- the alias/pool/scheduler editors) -- not
# meant to be hand-edited (a Settings save can overwrite it).
bitaxes:
  - ip: 192.168.1.65           # reserve/fix this via your router's DHCP so it never changes
    mac: aa:bb:cc:dd:ee:ff     # the device's real MAC, as-is -- separators optional, normalized automatically
    enabled: true
    hostname: my-miner
    alias: ""                  # optional display-name override -- shown everywhere hostname otherwise
                                # would be; unlike hostname, never overwritten by a discovery refresh
    model: bitaxe              # or: nerdaxe
    url: stratum.braiins.com
    port: 3333
    user: wallet.worker
    fallbackUrl: solo.atlaspool.io
    fallbackPort: 3333
    fallbackUser: wallet.worker
    schedule:                  # optional cron-based auto actions (seconds field included)
      - cron: "59 59 23 * * FRI"
        action: switch_fallback   # switch_primary | switch_fallback | restart
      - cron: "59 59 23 * * SUN"
        action: switch_primary
    alerts:                    # optional: this miner's own thresholds, overriding settings.yml's
      fanHigh: 95              # a value left unset follows every miner's
```

Override dashboard-api/remote-dashboard-api port: `server.port` in the config YAML (default `8080`/`8081`) — no env var for this.
The mailer's API port: `mailer.port` (default `8082`, loopback only) -- read by both the mailer and dashboard-api, which reaches it on `127.0.0.1`.
Override dashboard-api's data dir: `BITAXE_DATA_ROOT` env var (default from config's `storage.dataDir`).
remote-dashboard-api's data dir has no override of its own -- always `{storage.dataDir}/data/boards`; point `dataDir` itself at hashboard's data root (same machine, or a sibling checkout in local dev).

### Patterns & Constraints

- **No auth** — internal LAN only; no API keys, no CORS restrictions
- **Tests** — Go: stdlib `testing`/`httptest`; UI: Vitest + React Testing Library (see the README's Testing section)
- **No WebSocket** — polling-based; feeder writes files, API reads files
- **Graceful shutdown** — both binaries handle SIGINT/SIGTERM
- **Error handling** — minimal custom types; `fmt.Errorf()` wrapping + structured logging (stdlib only)
- **Confirmation dialogs** — destructive actions (restart, pool switch) require user confirmation in UI

### Key Dependencies

**Go:** `go-chi/chi/v5`, `robfig/cron/v3`, `go.yaml.in/yaml/v3`

**React:** `@tanstack/react-query`, `@mui/material`, `axios`, `zod`, `i18next`, `recharts`
