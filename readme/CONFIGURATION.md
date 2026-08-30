# Configuration

See the main [README](../README.md) for architecture and features — this doc
covers the config file format in full.

The config is split into **three files** to keep sensitive/mutable data out
of what you hand-edit and commit.

| File | Content | Committed to git |
|------|---------|-----------------|
| `dashboard.yml` | Process-launch settings: intervals, endpoints, storage, server port | Yes |
| `settings.yml` | Operational settings editable from `/settings`: electricity rate, remote push credentials, plus custom pool dashboards / firmware repo overrides on top of the built-in defaults — generated and managed through the UI (see below) | **No — add to `.gitignore`** |
| `miners.yml` | List of miners (`bitaxes:` section) — generated and managed through the `/settings` page, not something you normally write by hand (see below) | **No — add to `.gitignore`** |

No flag needed: `settings.yml` and `miners.yml` are each expected right
next to whatever file you pass to `-config` — feeder and dashboard-api
always agree on the same ones, so there's no way for the two to end up
watching different files. To put `settings.yml` somewhere else, set
`appSettingsFile: /path/to/settings.yml` at the top level of
`dashboard.yml` instead of passing a path on the command line --
`miners.yml`'s location can't be overridden the same way (see PR #3).
`electricity:`/`remote:` blocks written directly in `dashboard.yml` are
only used as the *initial* values the first time `settings.yml` doesn't
exist yet — once it exists, it's the source of truth for those.
`pools:`/`firmware.repos:` blocks in `dashboard.yml` are never read at
all — see the built-in defaults note under `settings.yml` below. A
`bitaxes:` block written directly in `dashboard.yml` is **not** read at
all — miners always come from the managed file. `-miners <path>` still
exists on the command line for backward compatibility, but is deprecated
and ignored (logs a warning) — safe to drop from any script that still
passes it.

---

## `dashboard.yml` — full example

```yaml
global:
  env: dev          # "dev" → stdout only; anything else → writes log files

# appSettingsFile: /path/to/settings.yml   # optional -- defaults to "settings.yml" next to this file

server:
  port: "8080"      # dashboard-api's listen port; remote-dashboard-api reads this too (default 8080/8081 per binary)

storage:
  dataDir: resources   # root data dir -- per-miner files land in {dataDir}/data/bitaxes/{mac}/,
                        # log files (env != dev) directly in {dataDir}/, firmware cache in
                        # {dataDir}/data/firmware_cache.json. Don't add "/data/bitaxes" yourself --
                        # the app appends that unconditionally (see server/internal/config.BitaxesDir).

feeder:
  interval: 2m      # how often to poll each device -- launch-time only, shown read-only on /settings

healthCheck:
  interval: 15s     # background reachability ping interval -- launch-time only, shown read-only on /settings

endpoints:
  timeout: 5s
  info:    api/system/info       # GET  — read device stats
  system:  api/system            # PUT  — push pool settings
  restart: api/system/restart    # POST — restart device

firmware:
  cacheTTL: 24h     # how long to cache the GitHub latest-release response -- launch-time only, shown read-only on /settings
  # repos: no longer set here -- built-in defaults, override from
  # /settings if needed (see settings.yml below)

# electricity / remote: see settings.yml below -- editable from
# /settings. Only used from here as the initial values the very first time
# settings.yml doesn't exist yet.
# pools.dashboards is not set here either -- built-in defaults, same as
# firmware.repos above.
```

---

## `settings.yml`

The operational subset of config you're likely to want to change without
redeploying: electricity rate, pool dashboard links, hashboard push
credentials, and firmware repo URLs. Like `miners.yml`, this is **managed
data** — the `/settings` page's "App settings" section generates and
updates it for you; you don't need to hand-write it. It's created
automatically on first save, and every save backs up whatever was there
right before to a single `settings.yml.bak` next to it (same
one-before-last backup behavior as `miners.yml`). A change saved here
applies to dashboard-api immediately and to the feeder (a separate
process) on its next poll cycle — no restart needed.

`electricity.ratePerKwh`/`remote.*` behave as before: until the first save,
their values come from `dashboard.yml`'s own `electricity:`/`remote:`
blocks — `settings.yml` not existing yet doesn't blank them out.

`pools.dashboards`/`firmware.repos` work differently: the well-known pool
dashboard links and the two firmware repo URLs (bitaxe/nerdaxe) are
**built into the binary** (`server/internal/config/defaults.go`) — adding
a pool or fixing a repo URL is a code change (a new release + `latest-up`
picks it up), not something `dashboard.yml` carries anymore. What
`settings.yml` stores for these two is **overrides only**:

- `pools.dashboards`: extra pool hostnames not in the built-in list (or a
  replacement URL for one that is — an entry here always wins over the
  built-in one for the same hostname). Editable from `/settings`.
- `firmware.repos`: per-model URL to use instead of the built-in one (e.g.
  to point `bitaxe` at a fork/mirror) — only set the model you actually
  want to override, the other keeps using its built-in default. **Not**
  exposed on `/settings` (shown there read-only, alongside the built-in
  URLs) — set this by hand-editing `settings.yml` if you ever need to.

The effective value the dashboard actually uses is always the built-in
defaults merged with whatever's in this file, computed fresh on every load
(so removing an override here really does fall back to the built-in
value, it doesn't linger). `/settings` shows the built-in pool list
read-only next to the editable custom-pool fields, and the firmware repos
table read-only with no edit fields at all.

```yaml
electricity:
  ratePerKwh: 0.1915   # €/kWh — used to estimate daily/monthly cost in the dashboard
                        # stored in every JSONL entry so historical rate is preserved

pools:
  dashboards:
    # Extra pool(s) not in the built-in list, or an override for one that
    # is -- same "hostname -> URL template" shape as the built-in registry,
    # {user} replaced by the account part of the stratum user
    myprivatepool.example.com: "https://myprivatepool.example.com/u/{user}"

firmware:
  repos:
    # Only set the model(s) you actually want to override
    bitaxe: "https://api.github.com/repos/myfork/esp-miner/releases/latest"

remote:
  pushURL: ""   # push URL from your hashboard dashboard (e.g. https://hashboard.live/api/push)
  apiKey:  ""   # API key from your hashboard dashboard
```

---

## `miners.yml`

You don't create or hand-write this file. It's treated as **managed data**,
the same way `latest.json`/the JSONL history are — the `/settings` page
generates and updates it for you:

- **Network scan** or **add by IP** finds a device and pre-fills its
  hostname, MAC, model, and whatever pool it's currently mining to
  (read straight off the device itself)
- Selecting a discovered device and saving **adds or updates** its entry
  (matched by MAC — re-scanning an already-configured device pulls in
  whatever changed on the device side, e.g. a new IP or a pool switched
  from the miner's own web UI)
- Each miner can be **enabled/disabled** from the same page
- Click a configured miner's row to expand its **scheduler**: add or
  remove cron-based jobs — switch to primary, switch to fallback, or
  restart (e.g. "switch to fallback every Friday at 23:59:59") — without
  hand-editing `schedule`. The cron expression is a raw 6-field string,
  seconds included (`sec min hour dayOfMonth month dayOfWeek`) — the
  editor shows a live human-readable translation and the next few run
  times as you type, and rejects anything that doesn't parse before it's
  saved. A schedule change takes effect on dashboard-api immediately, no
  restart needed, same as the rest of this file.
- The file is created automatically on first save — nothing needs to exist
  beforehand — and every save backs up whatever was there right before to
  a single `miners.yml.bak` next to it (overwritten on each save, so it's
  always just the one-before-last version, not a growing pile of files)
- dashboard-api and feeder both pick up any change to the file within their
  normal poll cycle, no restart needed — whether the change came from
  Settings or from hand-editing

The one thing Settings doesn't cover yet is **removing a miner entirely**
(it can disable one, not delete its entry) — that still needs a hand-edit.

```yaml
bitaxes:
  - ip: "192.168.1.65"
    mac: "aa:bb:cc:dd:ee:ff"
    enabled: true
    hostname: "bitaxe-1"
    model: "bitaxe"
    url:  "stratum.braiins.com"
    port: 3333
    user: "wallet.worker1"
    fallbackUrl:  "solo.atlaspool.io"
    fallbackPort: 3333
    fallbackUser: "bc1qxxx...xxx"
    schedule:                        # optional, editable from Settings
      - cron: "59 59 23 * * FRI"     # sec min hour dayOfMonth month dayOfWeek
        action: "switch_fallback"    # switch_primary | switch_fallback | restart
      - cron: "59 59 23 * * SUN"
        action: "switch_primary"
```
