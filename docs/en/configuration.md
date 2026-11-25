---
title: Configuration
nav_order: 5
group: Pages
lang: en
subnav:
  - title: Miners
    anchor: miners
  - title: Electricity
    anchor: electricity
  - title: Notifications
    anchor: notifications
  - title: Remote (hashboard.forlovers.app)
    anchor: remote
  - title: System
    anchor: system
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#miners" class="toc-card">
    <span class="toc-card-icon">🖥️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Miners</span>
      <span class="toc-card-sub">Detection, each miner's settings, actions</span>
    </span>
  </a>
  <a href="#electricity" class="toc-card">
    <span class="toc-card-icon">⚡</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Electricity</span>
      <span class="toc-card-sub">The rate and your other devices</span>
    </span>
  </a>
  <a href="#notifications" class="toc-card">
    <span class="toc-card-icon">✉️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Notifications</span>
      <span class="toc-card-sub">Mail server, audit report, alerts</span>
    </span>
  </a>
  <a href="#remote" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Remote</span>
      <span class="toc-card-sub">Sending to hashboard and your data</span>
    </span>
  </a>
  <a href="#system" class="toc-card">
    <span class="toc-card-icon">⚙️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">System</span>
      <span class="toc-card-sub">Alert thresholds, pools, firmware</span>
    </span>
  </a>
</div>

All the dashboard's settings, one section at a time. The sections' menu sums
each one up in a line, with an orange dot on what needs a look: a missing
recipient, a mail that failed, a pool that differs from the miner's…

![Configuration]({{ '/assets/images/settings.png' | relative_url }}){: width="736" }

---

## 🖥️ Miners
{: #miners }

<div class="text-toc">
  <a href="#automatic-detection">Detection</a><span class="text-toc-sep">·</span><a href="#configured-miners">Configured miners</a><span class="text-toc-sep">·</span><a href="#a-miners-panel">A miner's panel</a><span class="text-toc-sep">·</span><a href="#actions">Actions</a>
</div>

### Automatic detection
{: #automatic-detection }

Looks for AxeOS miners (bitaxe, nerdaxe) on your local network. A miner it
doesn't find (another subnet, a firewall…) is added by its IP, just below.

![Automatic detection]({{ '/assets/images/settings-scan-before.png' | relative_url }}){: width="533" }

The miners found show below, ready to be added.

![Detection results]({{ '/assets/images/settings-scan-results.png' | relative_url }}){: width="533" }

### Configured miners
{: #configured-miners }

Your miners: their name (and the hostname below when it differs), IP,
model, alert thresholds and state — a clock when the miner has scheduled
jobs, *Disabled* when it is.

- ⚙ Configure — opens its configuration panel, like a click on its row.
- 👁 View — opens its detail, the same as on the home screen.
- ⏸ Disable — after a confirmation, the miner is no longer polled: no more
  polls, alerts or scheduled jobs. Its configuration and its history stay;
  ▶ enables it again.

![Configured miners]({{ '/assets/images/settings-configured-miners.png' | relative_url }}){: width="533" }

### A miner's panel
{: #a-miners-panel }

A click on a miner opens its panel, on the right (full screen on a phone).
Its menu, like Configuration's, sums up each section; each one saves on its
own.

- Display name — the miner's name everywhere in the dashboard; empty, its
  hostname. A new detection keeps it.
- Pool — the primary and fallback pools (URL, port, user). *Swap primary
  and fallback* exchanges them. When they differ from the last poll's, a
  warning says so, with an orange dot on *Pool* in the menu.

![A miner's pool]({{ '/assets/images/settings-alias-pools.png' | relative_url }}){: width="627" }

- Alert thresholds — this miner's only, for a model that runs hotter or with
  a faster fan. An empty field follows every miner's thresholds, shown in
  grey. The gauge also shows the miner's current value (the dot).

![A miner's alert thresholds]({{ '/assets/images/settings-miner-alert-thresholds.png' | relative_url }}){: width="627" }

- Scheduler — a pool switch or a restart at a set time, in cron. Each job
  shows its action, when it runs in words, and its expression; while typing,
  the preview and the next runs show under the field.

![Scheduler]({{ '/assets/images/settings-schedule.png' | relative_url }}){: width="627" }

### Actions
{: #actions }

The *Actions* button, at the top of the list, unfolds what acts on all your
enabled miners at once.

![Actions]({{ '/assets/images/settings-miners-actions.png' | relative_url }}){: width="533" }

- Switch to a pool — the menu lists your miners' pools, with how many mine
  on it out of how many hold it. After a confirmation, each miner holding it
  switches to it, primary or fallback, then restarts. The summary shows at
  the bottom left, and each switch is written to the audit, with the pool
  left and the pool joined.
- Check the pools — compares each miner's two pools (URL, port, user) with
  the dashboard's: ✅ when they're the same, ❌ otherwise, with what differs.
  A miner that doesn't answer, or whose MAC isn't the right one, is *not
  read*. *Sync* saves the pools of the miners to fix in the dashboard.

![Pools check]({{ '/assets/images/settings-miners-check.png' | relative_url }}){: width="465" }

---

## ⚡ Electricity
{: #electricity }

The rate (€/kWh) gives the home screen's cost per day. Under the rate, your
other devices (fan, router…) and their power, counted on top of the miners;
each one is saved as soon as it's added or removed.

![Electricity]({{ '/assets/images/settings-electricity.png' | relative_url }}){: width="533" }

---

## ✉️ Notifications
{: #notifications }

The mails: the server sending them, to whom, the audit report and the
alerts.

![Notifications]({{ '/assets/images/settings-notifications.png' | relative_url }}){: width="533" }

- SMTP server — host, port, security (STARTTLS, TLS or none, the usual port
  offered on each choice), username and password if it needs them, sender
  address. The password isn't shown again: left empty, the saved one is
  kept.
- Recipients — added under the list, saved right away. Below, the mails'
  language and the dashboard's address, for their links.
- Test mail — sent to the recipients through the saved server. A
  notification confirms it went out, or gives the SMTP server's reason.
  While no mail can go out, a banner says what's missing.
- Audit report — a summary of the audit, every day, every 2 days, every
  week or every month, around 1 a.m. (UTC); every type or the ones picked,
  and nothing when nothing happened if you want. A failure is retried every
  hour.
- Alerts — a mail on every poll raising new alerts, once per alert, when it
  starts.

Under the report and the alerts, when the last one went out, or the last
failure with its reason; *Send an example* shows the mail without waiting.
[Mailer]({{ '/en/mailer.html' | relative_url }}){: .link-page }

---

## ☁️ Remote (hashboard.forlovers.app)
{: #remote }

Sending your miners' stats to
[hashboard.forlovers.app](https://hashboard.forlovers.app){:target="_blank" rel="noopener noreferrer"},
to follow them from anywhere, with no VPN.

![Remote (hashboard)]({{ '/assets/images/settings-remote.png' | relative_url }}){: width="533" }

- Your board — once sending is set up: its ID (click to open it), public or
  private, the last data received, how many of your miners it shows out of
  its limit, and a link to your account.
- Connection — the push URL and your hashboard API key. An empty URL stops
  sending. When hashboard refuses the key or doesn't answer, an alert says
  so here, with an orange dot on *Remote*.
- Remote actions — from your private board, restart a miner or switch it to
  its other pool, if you allow it. The dashboard picks the request up within
  a minute, does it and writes it to the audit. A mail on every action, if
  you turn it on.
- Your data's protection — your wallet, your pools and your miners' IPs are
  hidden before sending. One switch per piece of data to share it anyway.

Every change is written to the audit.
[Hashboard › Data protection]({{ '/en/hashboard.html#data-protection' | relative_url }}){: .link-page }

---

## ⚙️ System
{: #system }

<div class="text-toc">
  <a href="#alert-thresholds">Alert thresholds</a><span class="text-toc-sep">·</span><a href="#pool-dashboards">Pool dashboards</a><span class="text-toc-sep">·</span><a href="#firmware-repos">Firmware repos</a>
</div>

### Alert thresholds
{: #alert-thresholds }

The temperature and fan thresholds of all your miners — each can have its
own in its panel — and the margins, common to every miner. An alert ends
under its threshold minus its margin. Empty, they're the built-in values:
62 °C and 75 %, with margins of 2 °C and 5 %.

![Alert thresholds]({{ '/assets/images/settings-alert-thresholds.png' | relative_url }}){: width="533" }

The gauge shows the three zones: green until back to normal, yellow until
the threshold (the mark), red beyond it.

### Pool dashboards
{: #pool-dashboards }

The link making a pool clickable in the miners' list and detail. The known
pools (Braiins, Atlas…) already have one; for another one, add its hostname
and its dashboard's URL, with `{user}` in place of the stratum user's
account. *Show the built-in pools* unfolds the original ones.

![Pool dashboards]({{ '/assets/images/settings-pools.png' | relative_url }}){: width="533" }

### Firmware repos
{: #firmware-repos }

Where the dashboard looks for each model's latest firmware version, a
GitHub release — built into the application.

![Firmware repos]({{ '/assets/images/settings-firmware.png' | relative_url }}){: width="533" }

{% include page_nav.html position="bottom" %}
