# Deployment (Raspberry Pi)

Step-by-step guide for running axeos-dashboard as the long-lived service on your
LAN — typically a Raspberry Pi, but any always-on Linux machine works the same
way. Recommended path: fetch the prebuilt `linux/arm64` release (CI-built on
every push to `main`) instead of building locally — no Go toolchain needed on
the Pi itself.

See the main [README](../README.md) for architecture, features, and the full
config reference — this doc only covers getting a fresh machine running.

## 1. Clone

```bash
git clone https://github.com/joakim-ribier/axeos-dashboard.git
cd axeos-dashboard
```

## 2. Configure

`resources/dashboard.yml` is already committed with sane defaults — edit it
for your setup (electricity rate, pool dashboards, firmware repos, etc.).

You don't need to create `miners.yml` yourself — there's nothing to copy or
fill in before going further. It doesn't exist on a fresh clone, and that's
fine: once dashboard-api is running (step 4), open the app and go to
**Settings**, where a network scan or "add by IP" finds your miners and
creates/updates `miners.yml` for you. See [Configuration](CONFIGURATION.md)
for what that file ends up containing and the couple of things (like
cron-based pool schedules) still worth hand-editing.

### Recommended: keep config outside the clone

The example above keeps `dashboard.yml`/`miners.yml` inside the repo clone
(`resources/`), which is the simplest setup. In practice, on a long-lived
box, it's worth moving both **out** of the clone entirely so that
`git pull` / re-cloning for an update never touches your real config, and so
your data directory doesn't live inside a directory git considers part of
the repo. This is the layout a real production Pi in this project uses:

```
~/axeos-bitaxe-dashboard/
  config.yml              # renamed dashboard.yml -- storage.dataDir points at this same dir
  miners.yml               # auto-created by the /settings page on first save -- not something you place here yourself
  dashboard-api.log         # written directly under dataDir when global.env != dev
  feeder.log
  data/                     # {dataDir}/data -- the app appends "data/bitaxes" itself, always
    bitaxes/                #   -- see storage.dataDir in Configuration
    firmware_cache.json
  sources/
    axeos-dashboard/        # the actual git clone -- `make latest-up` is run from here
```

With this layout, `storage.dataDir` in `config.yml` is set to
`~/axeos-bitaxe-dashboard` itself (one level above `sources/`, and
**without** a trailing `/data/bitaxes` — see the `dataDir` note in
[Configuration](CONFIGURATION.md), it's appended automatically), and every
`make` invocation (manual, or from the systemd unit in step 5) passes
absolute paths: `CONFIG_FILE=~/axeos-bitaxe-dashboard/config.yml` — see
step 5's `ExecStart` for the exact form. Nothing else in this guide changes;
just substitute your own config/data paths wherever `resources/dashboard.yml`
or `/path/to/...` appears below.

## 3. Install and configure nginx (one-time)

nginx serves the static UI (`ui/dist`) and reverse-proxies `/api` to
dashboard-api, on port 80 — so you can just open `http://<pi-ip>/` from any
device on your LAN, no port number to remember. Same pattern as the
[hashboard](https://github.com/joakim-ribier/hashboard) VPS deployment, just
without TLS/domains since this is LAN-only.

### 3.1. Install

```bash
sudo apt update
sudo apt install -y nginx
```

### 3.2. Create the site config

Create `/etc/nginx/sites-available/axeos-dashboard` — **replace
`/path/to/axeos-dashboard` with the absolute path to your clone** (from step 1,
e.g. `/home/pi/axeos-dashboard`):

```nginx
server {
    listen 80 default_server;
    server_name _;

    # Everything under /api/ → dashboard-api (started by `make latest-up`)
    location /api/ {
        proxy_pass http://localhost:8080;
    }

    # Everything else → the static UI, falling back to index.html for
    # client-side routes (this is a single-page app — see the SPA explainer
    # earlier in this doc if that's unfamiliar)
    location / {
        root /path/to/axeos-dashboard/ui/dist;
        try_files $uri /index.html;
    }
}
```

If dashboard-api's port isn't the default `8080` (set via `server.port` in
`dashboard.yml`/`config.yml` — see [Configuration](CONFIGURATION.md)),
update the `proxy_pass` line to match.

### 3.3. Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/axeos-dashboard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # avoid a conflicting default_server on :80
sudo nginx -t                                 # validates the config syntax
sudo systemctl reload nginx
```

`sudo nginx -t` should print `syntax is ok` / `test is successful` — if it
doesn't, fix the reported line before reloading.

### 3.4. Fix the home directory permission (if your clone lives under `~`)

nginx runs as the `www-data` user, which by default **cannot traverse into your
home directory** — home directories are typically `700` (owner-only). If you skip
this, every request will 500, and `sudo tail /var/log/nginx/error.log` will show:

```
[crit] ... stat() "/home/you/axeos-dashboard/ui/dist/index.html" failed
(13: Permission denied)
```

Fix (only needs to be done once):

```bash
chmod o+x ~
```

This grants **traversal only** ("can pass through", not "can list contents") to
your home directory — it doesn't expose any other files there. Everything below
it (`axeos-dashboard/`, `ui/`, `dist/`, and the files inside) already ships with
normal `755`/`644` permissions from `git clone`, so this one `chmod` is enough —
you don't need to touch anything else in the path.

If you cloned outside your home directory entirely (e.g. `/opt/axeos-dashboard`),
you likely don't need this step at all.

### 3.5. Verify

```bash
curl -I http://localhost/                # expect: HTTP/1.1 200, Content-Type: text/html
curl -I http://localhost/some/route      # expect: 200 too (SPA fallback to index.html)
curl -I http://localhost/api/miners      # expect: 200 (or 401/whatever dashboard-api itself returns)
```

Then open `http://<pi-ip>/` from another device on the same network.

You won't need to touch nginx again after this — it keeps running as a system
service, and automatically serves whatever is currently in `ui/dist`. Re-running
`make latest-up` (step 4) overwrites `ui/dist` with the newest release; nginx
picks it up on the very next request, no reload needed.

## 4. Run

```bash
make latest-up
```

Downloads the feeder/dashboard-api/remote-dashboard-api binaries (and the UI into
`ui/dist`, for nginx to serve) from the latest GitHub Release, and starts
dashboard-api + feeder in a GNU screen session. nginx itself isn't managed by this
command — it's a system service, configured once in step 3, that keeps running and
just picks up new files whenever `latest-fetch`/`latest-up` refreshes `ui/dist`.

```bash
make latest-down   # stop dashboard-api + feeder
make dev-attach    # attach to the screen session
make dev-status    # list running sessions
```

## 5. Survive reboots (systemd)

nginx already auto-starts on boot (it's a systemd service by default). `make
latest-up` doesn't — it's a screen session, which doesn't survive a reboot — so
without this step, a power cycle leaves the UI reachable (served statically by
nginx) but `/api/*` dead until you SSH in and rerun `make latest-up` by hand.

Create `/etc/systemd/system/axeos-dashboard.service` — **replace both paths**
with your actual clone location and config file paths from steps 1–2:

```ini
[Unit]
Description=axeos-dashboard (dashboard-api + feeder via make latest-up)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/axeos-dashboard
ExecStart=/usr/bin/make latest-up CONFIG_FILE=/path/to/config.yml
ExecStop=/usr/bin/make latest-down
Restart=on-failure
RestartSec=15
User=your-username

[Install]
WantedBy=multi-user.target
```

`Type=oneshot` + `RemainAfterExit=yes` because `make latest-up` itself returns
quickly once it has spawned the detached screen session — the actual
long-running processes (dashboard-api, feeder) live inside that session, not as
children systemd tracks directly. `Restart=on-failure` retries if `latest-fetch`
fails (e.g. network not ready yet at boot), even though `After=network-online.target`
should normally prevent that.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now axeos-dashboard
```

Every start (including after every reboot) re-runs `make latest-up`, so it
fetches whatever is the current `latest` GitHub Release at that moment — same
self-updating behavior as running it by hand.

Verify:

```bash
sudo systemctl status axeos-dashboard --no-pager   # Active: active (exited); processes listed under CGroup
curl -I http://localhost/api/miners                # 200 once dashboard-api is up
```

Manage it like any systemd service from here on:

```bash
sudo systemctl stop axeos-dashboard      # runs `make latest-down`
sudo systemctl restart axeos-dashboard   # re-fetches + restarts
sudo journalctl -u axeos-dashboard -f    # follow logs
```

**In practice**, `systemctl enable` is mainly a reboot safety net — day to
day it's normal to manage the screen session by hand instead
(`make latest-up`/`make latest-down`/`make dev-attach` from an SSH session),
which leaves the systemd unit `enabled` but sitting `inactive (dead)` in
`systemctl status` even while dashboard-api/feeder are actually running fine
under `screen`. That's expected — `systemctl status` only reflects processes
it started itself, not ones you started manually in the same screen session
name. If you always go through `systemctl start`/`stop`, status stays
accurate throughout.

Two more things worth knowing if you inspect a real unit file with
`systemctl cat axeos-dashboard`:
- `MINERS_FILE=...` may still be present in an older `ExecStart` alongside
  `CONFIG_FILE=...` — harmless. `-miners` is deprecated (logged as a `WARN`
  on every start, see [Configuration](CONFIGURATION.md)) but ignored, and
  since `miners.yml` already sits next to `config.yml`, it's found
  automatically either way. Safe to drop `MINERS_FILE=...` from the unit
  the next time you touch it, but not urgent.
- There's no way to point `miners.yml` somewhere else anymore — it's
  always resolved right next to `config.yml`. If your unit's
  `CONFIG_FILE` lives in a different directory than `miners.yml`, move
  one to match the other.

## Logs & housekeeping

With `global.env` set to anything other than `dev` (i.e. real deployments —
see [Configuration](CONFIGURATION.md)), dashboard-api and feeder each write
structured JSON logs to a file next to your data: `{storage.dataDir}/dashboard-api.log`
and `{storage.dataDir}/feeder.log`. Nothing ships a log-rotation policy for
these out of the box, and feeder in particular logs one line per device per
poll — on a box with several miners polled every couple of minutes, an
unrotated log can reach several hundred MB within days. Set up `logrotate`
for them; a minimal config works:

```
# /etc/logrotate.d/axeos-dashboard
/path/to/axeos-bitaxe-dashboard/*.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
    copytruncate
}
```

`copytruncate` matters here — the running feeder/dashboard-api processes
hold the log file open for the life of the process (no signal-based
"reopen" support), so a plain `rotate` that renames the file out from under
them would silently keep writing into the renamed (soon deleted) file
instead of a fresh one.

## Building from source instead (advanced)

`make dev-up`/`make build` are for local development (e.g. testing a change
before opening a PR) — not recommended for deploying on a Pi, since it means
installing the Go toolchain there. If you still want to build locally instead
of using `make latest-up`:

```bash
make build
# → resources/build/server/bin/feeder
# → resources/build/server/bin/dashboard-api
# → resources/build/server/bin/remote-dashboard-api
```

Or run the binaries manually (background processes). Both expect
`miners.yml` right next to `dashboard.yml` (see
[Configuration](CONFIGURATION.md)):

```bash
# Feeder (background)
nohup ./resources/build/server/bin/feeder \
  -config /path/to/dashboard.yml \
  > feeder.log 2>&1 &

# Dashboard API (background)
nohup ./resources/build/server/bin/dashboard-api \
  -config /path/to/dashboard.yml \
  > dashboard-api.log 2>&1 &

# UI (static build served by nginx as configured in step 3, or `npm run dev` for local testing)
cd ui && npm run build   # → ui/dist/
```

Override the API port (default `8080` for dashboard-api, `8081` for
remote-dashboard-api): set `server.port` in the config YAML — there's no
env var for this:

```yaml
server:
  port: "9090"
```

Override dashboard-api/feeder's local data dir (default from config's `storage.dataDir`):

```bash
BITAXE_DATA_ROOT=/path/to/data ./resources/build/server/bin/dashboard-api -config dashboard.yml
```

remote-dashboard-api has no env var override — its data dir is `storage.boardsDir`
in `remote-dashboard.yml` (defaults to `{dataDir}/data/boards` when empty).
