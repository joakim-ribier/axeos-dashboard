# Configuration

See the main [README](../README.md) for architecture and features — this doc
covers the config file format in full.

The config is split into **two files** to keep sensitive miner details out of the repository.

| File | Content | Committed to git |
|------|---------|-----------------|
| `dashboard.yml` | Global settings: intervals, endpoints, storage, electricity rate, pool dashboards, firmware repos | Yes |
| `miners.yml` | List of miners (`bitaxes:` section) — generated and managed through the `/settings` page, not something you normally write by hand (see below) | **No — add to `.gitignore`** |

No flag needed: `miners.yml` is expected right next to whatever file you pass
to `-config` — feeder and dashboard-api always agree on the same one, so
there's no way for the two to end up watching different files. A `bitaxes:`
block written directly in `dashboard.yml` is **not** read — miners always
come from the managed file. `-miners <path>` still exists on the command
line for backward compatibility, but is deprecated and ignored (logs a
warning) — safe to drop from any script that still passes it.

---

## `dashboard.yml` — full example

```yaml
global:
  env: dev          # "dev" → stdout only; anything else → writes log files

server:
  port: "8080"      # dashboard-api's listen port; remote-dashboard-api reads this too (default 8080/8081 per binary)

storage:
  dataDir: resources   # root data dir -- per-miner files land in {dataDir}/data/bitaxes/{mac}/,
                        # log files (env != dev) directly in {dataDir}/, firmware cache in
                        # {dataDir}/data/firmware_cache.json. Don't add "/data/bitaxes" yourself --
                        # the app appends that unconditionally (see server/internal/config.BitaxesDir).

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
- Click a configured miner's row to expand its **pool scheduler**: add or
  remove cron-based pool switches (e.g. "switch to fallback every Friday
  at 23:59:59") without hand-editing `poolSchedule`. The cron expression
  is a raw 6-field string, seconds included (`sec min hour dayOfMonth
  month dayOfWeek`) — the editor shows a live human-readable translation
  and the next few run times as you type, and rejects anything that
  doesn't parse before it's saved. A schedule change takes effect on
  dashboard-api immediately, no restart needed, same as the rest of this
  file.
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
    poolSchedule:                    # optional, editable from Settings
      - cron: "59 59 23 * * FRI"     # sec min hour dayOfMonth month dayOfWeek
        target: "fallback"
      - cron: "59 59 23 * * SUN"
        target: "primary"
```
