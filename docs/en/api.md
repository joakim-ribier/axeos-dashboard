---
title: API
nav_order: 10
group: Dev
lang: en
---

{% include page_nav.html position="top" %}

Browsable reference for the dashboard-api, remote-dashboard-api and mailer
REST endpoints, generated straight from the handler annotations in the Go
code — always in sync with what's actually deployed. Endpoints are grouped
by service, then by domain (miners, alerts, audit, configuration…).

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make swagger</span>
<span class="term-comment">&gt;&gt;&gt; Regenerating OpenAPI spec...</span>
cd server && go tool swag init -g cmd/dashboard-api/main.go -o docs/swagger --outputTypes json,yaml --parseInternal
...
create swagger.json at docs/swagger/swagger.json
create swagger.yaml at docs/swagger/swagger.yaml
cp server/docs/swagger/swagger.json docs/assets/api/swagger.json
<span class="term-comment">&gt;&gt;&gt; Done. See server/docs/swagger/swagger.yaml and docs/assets/api/swagger.json</span></pre>
</div>

[Open full screen]({{ '/assets/api/index.html' | relative_url }}){:target="_blank" rel="noopener noreferrer"}

<iframe src="{{ '/assets/api/index.html' | relative_url }}" style="width: 100%; height: 85vh; border: 1px solid var(--border-color, #454545); border-radius: 6px; margin-top: 1rem;"></iframe>

Raw spec, to import into another tool:
[`swagger.yaml`](https://github.com/joakim-ribier/axeos-dashboard/blob/main/server/docs/swagger/swagger.yaml){:target="_blank" rel="noopener noreferrer"} /
[`swagger.json`]({{ '/assets/api/swagger.json' | relative_url }}){:target="_blank" rel="noopener noreferrer"}.

---

## 🔎 An audit entry
{: #audit-entry }

An operation done from the dashboard:

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
      <th>Content</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>ts</code></td><td>Date and time, in UTC</td></tr>
    <tr><td><code>source</code></td><td><code>api</code> (from the dashboard) or <code>system</code> (by the application itself)</td></tr>
    <tr><td><code>type</code></td><td>The event type — see the Audit page</td></tr>
    <tr><td><code>target</code></td><td>The miner's IP — absent for a configuration save or a switch on every miner</td></tr>
    <tr><td><code>ip</code></td><td><code>api</code> — the IP address of the device that asked</td></tr>
    <tr><td><code>userAgent</code></td><td><code>api</code> — that device's browser</td></tr>
    <tr><td><code>requestId</code></td><td><code>api</code> — the request's ID, the same as in the dashboard's logs</td></tr>
    <tr><td><code>status</code></td><td><code>api</code> — the response's HTTP code (400 or more: a failure)</td></tr>
    <tr><td><code>query</code></td><td><code>api</code> — the request's parameters: the months downloaded, the period and filters exported, the miner targeted…</td></tr>
    <tr><td><code>service</code></td><td><code>system</code> — who acted: <code>scheduler</code>, <code>backup</code> (the nightly backup), <code>mailer</code> (notifications) or <code>remote</code> (an action asked from your board, with its IP and browser)</td></tr>
    <tr><td><code>cron</code></td><td><code>system</code> — the cron expression that triggered the operation</td></tr>
    <tr><td><code>error</code></td><td>The error message, on a failure</td></tr>
    <tr><td><code>changes</code></td><td>What changed — each field with its kind (<code>kind</code>): <code>changed</code> (value before <code>before</code> → after <code>after</code>), or a list item <code>added</code> (<code>after</code>) or <code>removed</code> (<code>before</code>)</td></tr>
  </tbody>
</table>

---

## 🗄️ The audit: storage and routes
{: #audit-storage }

The entries are appended to one file per day (UTC):
`{dataDir}/data/audit/YYYY-MM-DD.jsonl` (`./storage/data/audit/` with
Docker), one JSON entry per line.

Three API routes expose them:

- `GET /api/audit` — the entries between `from` and `to` (RFC 3339 dates,
  the last 24 hours by default, a year at most), filtered by `ip` (miner) and
  `type`, paginated with `page` and `pageSize`.
- `GET /api/audit/types` — every type, in the order the dashboard offers
  them: the value `type` expects.
- `GET /api/audit/export` — the same parameters, without pagination: the
  JSON file of the *Export* button, the period and the filters before the
  list of entries.

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

`GET /api/audit/types` answers:

```json
{
  "types": [
    "restart",
    "switch_primary",
    "switch_fallback",
    "switch_pool",
    "save_miners",
    "save_settings",
    "export_audit",
    "download_backups",
    "discover",
    "backup",
    "audit_report",
    "alert_mail",
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

Each type is explained on the Audit page.
[Audit › Events recorded]({{ '/en/audit.html#events' | relative_url }}){: .link-page }

{% include page_nav.html position="bottom" %}
