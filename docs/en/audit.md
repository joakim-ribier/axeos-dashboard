---
title: Audit
nav_order: 6.5
group: Pages
lang: en
subnav:
  - title: Recorded events
    anchor: events
  - title: Entry contents
    anchor: entry
  - title: Storage and API
    anchor: storage
  - title: Hide the page
    anchor: hide
---

# Audit

<div class="toc-grid">
  <a href="#events" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-title">Recorded events</span>
  </a>
  <a href="#entry" class="toc-card">
    <span class="toc-card-icon">🔎</span>
    <span class="toc-card-title">Entry contents</span>
  </a>
  <a href="#storage" class="toc-card">
    <span class="toc-card-icon">🗄️</span>
    <span class="toc-card-title">Storage and API</span>
  </a>
  <a href="#hide" class="toc-card">
    <span class="toc-card-icon">🙈</span>
    <span class="toc-card-title">Hide the page</span>
  </a>
</div>

The history of everything that changes a miner or the configuration,
takes data off the Pi or scans the network, whether from the dashboard or
by the scheduler.

![Audit page]({{ '/assets/images/audit.png' | relative_url }})

The page shows the **last 24 hours** by default, newest first. The
calendar shows another day, from midnight to midnight in local time.

- **Filters** — by miner, by event type and by day. Each active filter
  shows up as a chip below the bar: its cross removes it, **Clear all**
  removes them all. The period's event count is shown on the right.
- **One row per event** — a green dot if the operation succeeded, red if
  it failed, followed by the event type and the miner involved. Below:
  - for an operation made from the dashboard: the time, the device's IP
    address and browser (full details on hover);
  - for a scheduler operation: the time and the cron expression that
    triggered it;
  - on failure, the error code and message.
- **Copy** — the icon at the end of the row copies the full entry, as
  JSON.
- **Export** — downloads every entry of the current period and filters
  (not just the page shown) as a JSON file.

---

## 📋 Recorded events
{: #events }

Only actions triggered from the dashboard or by the scheduler are
recorded, whether they succeed or fail: changes, data leaving the Pi
(exports, backups) and network scans.

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Label</th>
      <th>From the dashboard</th>
      <th>By the scheduler</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>restart</code></td>
      <td>Restart</td>
      <td><code>POST /api/miners/{hostnameOrIp}/restart</code></td>
      <td>✅</td>
    </tr>
    <tr>
      <td><code>switch_primary</code></td>
      <td>Switch to primary pool</td>
      <td><code>PUT /api/miners/pool/primary/enable</code></td>
      <td>✅</td>
    </tr>
    <tr>
      <td><code>switch_fallback</code></td>
      <td>Switch to fallback pool</td>
      <td><code>PUT /api/miners/pool/fallback/enable</code></td>
      <td>✅</td>
    </tr>
    <tr>
      <td><code>save_miners</code></td>
      <td>Miners saved</td>
      <td><code>POST /api/config/miners</code></td>
      <td></td>
    </tr>
    <tr>
      <td><code>save_settings</code></td>
      <td>Settings saved</td>
      <td><code>POST /api/config/settings</code></td>
      <td></td>
    </tr>
    <tr>
      <td><code>export_audit</code></td>
      <td>Audit export</td>
      <td><code>GET /api/audit/export</code></td>
      <td></td>
    </tr>
    <tr>
      <td><code>download_backups</code></td>
      <td>Backups download</td>
      <td><code>GET /api/backups/download</code></td>
      <td></td>
    </tr>
    <tr>
      <td><code>discover</code></td>
      <td>Network discovery</td>
      <td><code>GET /api/config/discover</code></td>
      <td></td>
    </tr>
  </tbody>
</table>

A pool switch applied to every miner at once is recorded once, with
**all miners** as its target. It also shows up when filtering on a
specific miner.

---

## 🔎 Entry contents
{: #entry }

An operation made from the dashboard:

```json
{
  "ts": "2026-10-10T07:57:41Z",
  "source": "api",
  "type": "restart",
  "target": "192.168.1.65",
  "ip": "192.168.1.20",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "requestId": "raspberrypi/xzGLtihnkN-000057",
  "status": 204
}
```

A scheduler operation, here a failed one:

```json
{
  "ts": "2026-10-09T21:59:59Z",
  "source": "system",
  "service": "scheduler",
  "type": "switch_fallback",
  "target": "192.168.1.65",
  "cron": "59 59 23 * * FRI",
  "error": "switch pool for 192.168.1.65: … connect: connection refused"
}
```

<table class="data-table">
  <thead>
    <tr>
      <th>Field</th>
      <th>Contents</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>ts</code></td><td>Date and time, in UTC</td></tr>
    <tr><td><code>source</code></td><td><code>api</code> (from the dashboard) or <code>system</code> (by the app itself)</td></tr>
    <tr><td><code>type</code></td><td>The event type — see the table above</td></tr>
    <tr><td><code>target</code></td><td>The IP of the miner involved — absent for a configuration save or a switch on every miner</td></tr>
    <tr><td><code>ip</code></td><td><code>api</code> — the IP address of the device that made the request</td></tr>
    <tr><td><code>userAgent</code></td><td><code>api</code> — that device's browser</td></tr>
    <tr><td><code>requestId</code></td><td><code>api</code> — the request's ID, the same as in the dashboard's logs</td></tr>
    <tr><td><code>status</code></td><td><code>api</code> — the response's HTTP code (400 or more: failure)</td></tr>
    <tr><td><code>query</code></td><td><code>api</code> — the request's parameters: the months downloaded, the exported period and filters, the targeted miner…</td></tr>
    <tr><td><code>service</code></td><td><code>system</code> — the part of the app that acted: <code>scheduler</code></td></tr>
    <tr><td><code>cron</code></td><td><code>system</code> — the cron expression that triggered the operation</td></tr>
    <tr><td><code>error</code></td><td>The error message, on failure</td></tr>
  </tbody>
</table>

---

## 🗄️ Storage and API
{: #storage }

Entries are appended to one file per day (UTC):
`{dataDir}/data/audit/YYYY-MM-DD.jsonl` (`./storage/data/audit/` with
Docker), one JSON entry per line.

Two API routes expose them:

- `GET /api/audit` — the entries between `from` and `to` (RFC 3339 dates,
  the last 24 hours by default, 7 days at most), filterable by `ip`
  (miner) and `type`, paginated with `page` and `pageSize`.
- `GET /api/audit/export` — same parameters, unpaginated: the
  **Export** button's JSON file, which states the period and filters
  before the list of entries.

```json
{
  "from": "2026-10-09T08:00:00Z",
  "to": "2026-10-10T08:00:00Z",
  "type": "restart",
  "exportedAt": "2026-10-10T08:00:00Z",
  "total": 6,
  "entries": [ … ]
}
```

Parameter details are on the [API]({{ '/en/api.html' | relative_url }}) page.

---

## 🙈 Hide the page
{: #hide }

The page and its menu entry can be hidden from `dashboard.yml` (dashboard
restart needed). The dashboard keeps recording events.

```yaml
ui:
  page:
    audit: hidden   # enabled (default) | hidden
```
