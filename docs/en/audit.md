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
by the app itself (scheduler, nightly backup).

![Audit page]({{ '/assets/images/audit.png' | relative_url }})

The page shows the **last 24 hours** by default, newest first. The
calendar shows another day, from midnight to midnight UTC. Times are in
UTC, like Backups and the audit report mail: an event carries the same
time everywhere.

- **Filters** — by miner, by event type and by day. Each active filter
  shows up as a chip below the bar: its cross removes it, **Clear all**
  removes them all. The period's event count is shown on the right.
- **One row per event** — a green dot if the operation succeeded, red if
  it failed, followed by the event type and the miner involved. Below:
  - for an operation made from the dashboard: the time, the device's IP
    address and browser (full details on hover);
  - for a scheduler operation: the time and the cron expression that
    triggered it;
  - for the nightly backup: the time and the month updated;
  - on failure, the error code and message.
- **Copy** — the icon at the end of the row copies the full entry, as
  JSON.
- **Export** — downloads every entry of the current period and filters
  (not just the page shown) as a JSON file.

---

## 📋 Recorded events
{: #events }

The audit traces what was done **through the tool**: by someone in the
dashboard, or by the app itself (its scheduler, its nightly backup).
Each entry says **what** (the type),
**when**, **who** (the device's IP and browser, or the scheduler and its
job), **on what** (the miner) and **with which result** (success, or
failure with its error message). A failed action is recorded too.

### ⚙️ Miner actions

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Label</th>
      <th>From</th>
      <th>What the entry holds</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>restart</code></td>
      <td>Restart</td>
      <td>a miner's panel › Restart; or a scheduler job</td>
      <td>the restarted miner</td>
    </tr>
    <tr>
      <td><code>switch_primary</code></td>
      <td>Switch to primary pool</td>
      <td>a miner's panel › Switch pool; or a scheduler job</td>
      <td>the switched miner — <strong>all miners</strong> when the switch targets them all (direct API call)</td>
    </tr>
    <tr>
      <td><code>switch_fallback</code></td>
      <td>Switch to fallback pool</td>
      <td>same</td>
      <td>same</td>
    </tr>
  </tbody>
</table>

### 🛠️ Configuration

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Label</th>
      <th>From</th>
      <th>What the entry holds</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>save_miners</code></td>
      <td>Miners saved</td>
      <td>Settings page: save discovered miners, enable / disable, disable all, alias, pools, schedule</td>
      <td>per changed miner, what changed outside sensitive changes: alias, hostname, model (before → after). On failure: a single entry, with no miner</td>
    </tr>
    <tr>
      <td><code>save_settings</code></td>
      <td>Settings saved</td>
      <td>Settings page › App settings: rate, other devices, pool dashboards, remote</td>
      <td>what changed outside sensitive changes: the rate (before → after), the other devices, pool dashboards and firmware repos added or removed. On failure: a single entry</td>
    </tr>
  </tbody>
</table>

### 📤 Data and network

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Label</th>
      <th>From</th>
      <th>What the entry holds</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>export_audit</code></td>
      <td>Audit export</td>
      <td>Audit page › Export</td>
      <td>the exported period and filters</td>
    </tr>
    <tr>
      <td><code>download_backups</code></td>
      <td>Backups download</td>
      <td>Backups page › Download</td>
      <td>the months downloaded</td>
    </tr>
    <tr>
      <td><code>discover</code></td>
      <td>Network discovery</td>
      <td>Settings page › Automatic detection (network scan, or add by IP)</td>
      <td>the scanned range or the probed IP</td>
    </tr>
    <tr>
      <td><code>backup</code></td>
      <td>Backup updated</td>
      <td>every night, by the app: the completed day is added to its month's archive (see <a href="{{ '/en/backups.html' | relative_url }}">Backups</a>)</td>
      <td>the month(s) whose archive was updated</td>
    </tr>
    <tr>
      <td><code>audit_report</code></td>
      <td>Audit report sent</td>
      <td>at night, by the mailer, at the frequency chosen in Settings › Notifications</td>
      <td>the period covered and the recipients; the error if it failed</td>
    </tr>
  </tbody>
</table>

### 🔐 Sensitive changes

A configuration save that holds sensitive changes produces, **instead of**
<code>save_miners</code> or <code>save_settings</code>, one dedicated
entry per sensitive change: one entry per fact, no duplicate line. Each
comes with its detail (values **before → after**, or the job added or
removed), so it can be searched for directly. One save can produce several
(e.g. a miner's pool **and** its schedule).

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Label</th>
      <th>When</th>
      <th>Detail</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>miner_pool</code></td>
      <td>Miner pool changed</td>
      <td>a miner's primary or fallback pool URL, port or user changes</td>
      <td>each changed field — e.g. <em>Fallback user: bc1q…abc.w1 → bc1q…xyz.w1</em></td>
    </tr>
    <tr>
      <td><code>miner_schedule</code></td>
      <td>Schedule changed</td>
      <td>a scheduled job is added or removed (a job is never edited: changing one is removing it and adding another)</td>
      <td>each job added or removed, spelled out — e.g. <em>Job added: Restart · At 12:00 AM, only on Wednesday (0 0 0 * * WED)</em></td>
    </tr>
    <tr>
      <td><code>miner_identity</code></td>
      <td>Miner IP changed</td>
      <td>an already configured miner's IP changes (the miner is matched by its MAC)</td>
      <td>the old and new IP</td>
    </tr>
    <tr>
      <td><code>miner_disabled</code> / <code>miner_enabled</code></td>
      <td>Miner disabled / enabled</td>
      <td>a miner is disabled (no longer monitored nor scheduled) or re-enabled</td>
      <td>—</td>
    </tr>
    <tr>
      <td><code>miner_added</code></td>
      <td>Miner added</td>
      <td>a miner joins the configuration</td>
      <td>its pools (URL, port, user) and its scheduled jobs</td>
    </tr>
    <tr>
      <td><code>remote_push</code></td>
      <td>Remote push changed</td>
      <td>the hashboard push URL or API key changes</td>
      <td>the URL before and after; the API key is never written down, only "changed"</td>
    </tr>
    <tr>
      <td><code>mail_settings</code></td>
      <td>Notifications changed</td>
      <td>the SMTP server or the mail recipients change</td>
      <td>each server field before and after, the recipients added or removed; the password is never written down, only "changed"</td>
    </tr>
  </tbody>
</table>

The rest of a save (alias, hostname, model, rate, devices, pool
dashboards, firmware repos) is detailed under <code>save_miners</code> /
<code>save_settings</code>: each fact is written once, under one type.
A save that changes nothing isn't recorded.

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
    <tr><td><code>service</code></td><td><code>system</code> — the part of the app that acted: <code>scheduler</code>, <code>backup</code> (nightly backup) or <code>mailer</code></td></tr>
    <tr><td><code>cron</code></td><td><code>system</code> — the cron expression that triggered the operation</td></tr>
    <tr><td><code>error</code></td><td>The error message, on failure</td></tr>
    <tr><td><code>changes</code></td><td>What changed — each field with its kind (<code>kind</code>): <code>changed</code> (value <code>before</code> → <code>after</code>), or a list item <code>added</code> (<code>after</code>) or <code>removed</code> (<code>before</code>)</td></tr>
  </tbody>
</table>

---

## 🗄️ Storage and API
{: #storage }

Entries are appended to one file per day (UTC):
`{dataDir}/data/audit/YYYY-MM-DD.jsonl` (`./storage/data/audit/` with
Docker), one JSON entry per line.

Three API routes expose them:

- `GET /api/audit` — the entries between `from` and `to` (RFC 3339 dates,
  the last 24 hours by default, a year at most), filterable by `ip`
  (miner) and `type`, paginated with `page` and `pageSize`.
- `GET /api/audit/types` — every type, in the order the dashboard offers
  them: the values `type` accepts.
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

The response of `GET /api/audit/types` — each type is explained in
[Recorded events](#events):

```json
{
  "types": [
    "restart",
    "switch_primary",
    "switch_fallback",
    "save_miners",
    "save_settings",
    "export_audit",
    "download_backups",
    "discover",
    "backup",
    "audit_report",
    "miner_pool",
    "miner_schedule",
    "miner_identity",
    "miner_disabled",
    "miner_enabled",
    "miner_added",
    "remote_push",
    "mail_settings"
  ]
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
