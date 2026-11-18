---
title: Audit
nav_order: 6.5
group: Pages
lang: en
subnav:
  - title: The page
    anchor: page
  - title: Events recorded
    anchor: events
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#page" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-text">
      <span class="toc-card-title">The page</span>
      <span class="toc-card-sub">The filters and a day's events</span>
    </span>
  </a>
  <a href="#events" class="toc-card">
    <span class="toc-card-icon">🗂️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Events recorded</span>
      <span class="toc-card-sub">Each type, where it comes from</span>
    </span>
  </a>
</div>

Everything that acts on a miner or on the configuration, takes data out or
scans the network — from the dashboard, from your board, or by the
application itself.

## 📋 The page
{: #page }

![Audit page]({{ '/assets/images/audit.png' | relative_url }}){: width="723" }

1. Miner — one miner, or all of them.
2. Type — one event type, or all of them.
3. Day — a day, from midnight to midnight UTC; empty, the last 24 hours.
4. Export — every entry of the period and the filters, in a JSON file.
5. By the application — here the scheduler, with the cron expression that
   triggered the action.
6. Copy — the whole entry, in JSON.
7. From the dashboard — with the device's IP and browser (the detail on
   hover).
8. The nightly backup — with the month updated.

A green dot for a success, red for a failure, with the error's code and
message. The times are in UTC, like in the Backups and the audit report by
mail: an event has the same time everywhere.

---

## 🗂️ Events recorded
{: #events }

Each entry says what (the type), when, who (the IP and the browser, your
board, or the part of the application that acted), on which miner, and the
outcome. An action that fails is recorded too.

### ⚙️ Actions on the miners

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Label</th>
      <th>From</th>
      <th>Content</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>restart</code></td>
      <td>Restart</td>
      <td>a miner's detail, a scheduler job, or your board</td>
      <td>the miner restarted</td>
    </tr>
    <tr>
      <td><code>switch_primary</code></td>
      <td>Switch to primary pool</td>
      <td>a miner's detail, a scheduler job, or your board</td>
      <td>the miner, the pool left and the pool joined</td>
    </tr>
    <tr>
      <td><code>switch_fallback</code></td>
      <td>Switch to fallback pool</td>
      <td>same</td>
      <td>same</td>
    </tr>
    <tr>
      <td><code>switch_pool</code></td>
      <td>Switch to a pool</td>
      <td>Configuration › Miners › Actions › Switch to a pool, one entry per miner switched</td>
      <td>the miner, the pool left and the pool joined; every miner when none had to switch</td>
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
      <th>Content</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>save_miners</code></td>
      <td>Miners saved</td>
      <td>Configuration: detection, enabling, name, pools, scheduler</td>
      <td>for each miner, what changed outside the sensitive changes: name, hostname, model (before → after)</td>
    </tr>
    <tr>
      <td><code>save_settings</code></td>
      <td>Settings saved</td>
      <td>Configuration: electricity, pool dashboards, remote</td>
      <td>what changed outside the sensitive changes: the rate (before → after), the devices and pool dashboards added or removed</td>
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
      <th>Content</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>export_audit</code></td>
      <td>Audit export</td>
      <td>Audit › Export</td>
      <td>the period and the filters exported</td>
    </tr>
    <tr>
      <td><code>download_backups</code></td>
      <td>Backups download</td>
      <td>Backups › Download</td>
      <td>the months downloaded</td>
    </tr>
    <tr>
      <td><code>discover</code></td>
      <td>Network discovery</td>
      <td>Configuration › Automatic detection, or add by IP</td>
      <td>the range scanned or the IP probed</td>
    </tr>
    <tr>
      <td><code>backup</code></td>
      <td>Backup updated</td>
      <td>every night, by the application</td>
      <td>the months whose archive was updated</td>
    </tr>
    <tr>
      <td><code>audit_report</code></td>
      <td>Audit report sent</td>
      <td>at night, by the mailer, at the chosen frequency</td>
      <td>the period and the recipients; the error on a failure</td>
    </tr>
    <tr>
      <td><code>alert_mail</code></td>
      <td>Alerts mail not sent</td>
      <td>by the mailer, when the new alerts' mail couldn't go out</td>
      <td>the poll concerned and the error</td>
    </tr>
  </tbody>
</table>

### 🔐 Sensitive changes

A save holding a sensitive change records it in an entry of its own,
instead of <code>save_miners</code> or <code>save_settings</code>, with
before → after: you find it by its type. One save can produce several, a
miner's pool and its scheduler for instance.

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
      <td>a pool's URL, port or user changes</td>
      <td>each field — e.g. <em>Fallback user: bc1q…abc.w1 → bc1q…xyz.w1</em></td>
    </tr>
    <tr>
      <td><code>miner_schedule</code></td>
      <td>Schedule changed</td>
      <td>a scheduled job is added or removed</td>
      <td>each job, in words — e.g. <em>Job added: Restart · At 00:00, on Wednesday only (0 0 0 * * WED)</em></td>
    </tr>
    <tr>
      <td><code>miner_identity</code></td>
      <td>Miner IP changed</td>
      <td>a miner's IP changes (it's recognised by its MAC)</td>
      <td>the old and the new IP</td>
    </tr>
    <tr>
      <td><code>miner_disabled</code> / <code>miner_enabled</code></td>
      <td>Miner disabled / enabled</td>
      <td>a miner is disabled or enabled again</td>
      <td>—</td>
    </tr>
    <tr>
      <td><code>miner_added</code></td>
      <td>Miner added</td>
      <td>a miner joins the configuration</td>
      <td>its pools and its scheduled jobs</td>
    </tr>
    <tr>
      <td><code>remote_push</code></td>
      <td>Remote push changed</td>
      <td>the push URL, the API key, a remote action or the data protection changes</td>
      <td>each setting before and after; the API key only reads "changed"</td>
    </tr>
    <tr>
      <td><code>mail_settings</code></td>
      <td>Notifications changed</td>
      <td>the SMTP server or the recipients change</td>
      <td>each field before and after, the recipients added or removed; the password only reads "changed"</td>
    </tr>
  </tbody>
</table>

A save that changes nothing isn't recorded.

{% include page_nav.html position="bottom" %}
