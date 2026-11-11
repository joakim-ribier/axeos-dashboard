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
  - title: Remote (hashboard.live)
    anchor: remote
  - title: System
    anchor: system
---

# Configuration

<div class="toc-grid">
  <a href="#miners" class="toc-card">
    <span class="toc-card-icon">🖥️</span>
    <span class="toc-card-title">Miners</span>
  </a>
  <a href="#electricity" class="toc-card">
    <span class="toc-card-icon">⚡</span>
    <span class="toc-card-title">Electricity</span>
  </a>
  <a href="#notifications" class="toc-card">
    <span class="toc-card-icon">✉️</span>
    <span class="toc-card-title">Notifications</span>
  </a>
  <a href="#remote" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-title">Remote (hashboard.live)</span>
  </a>
  <a href="#system" class="toc-card">
    <span class="toc-card-icon">⚙️</span>
    <span class="toc-card-title">System</span>
  </a>
</div>

One page, one section at a time: each section is picked from a menu that
sums it up in one line, and flags with an orange dot what needs a look
(no recipient, audit report or alerts mail failing, pool differing from
the configuration...).

![Configuration]({{ '/assets/images/settings.png' | relative_url }})

---

## 🖥️ Miners
{: #miners }

### Automatic detection
{: #automatic-detection }

Scans the local network for AxeOS miners (bitaxe, nerdaxe). A miner that
can't be found this way (different subnet, firewall...) can be added
directly by IP, right under it.

![Automatic detection]({{ '/assets/images/settings-scan-before.png' | relative_url }})

Miners found appear below, ready to be added to the configuration.

![Detection results]({{ '/assets/images/settings-scan-results.png' | relative_url }})

### Configured miners
{: #configured-miners }

The list of already-configured miners: name (the alias, and the hostname
under it when they differ), IP, model, alert thresholds and status — a
clock for a miner with scheduled tasks, **Disabled** for a disabled
miner. On a phone, each miner takes a few short lines instead of a table.

Each miner's actions:

- ⚙ **Configure** opens its configuration panel, like a click on its row
  (see [A miner's panel](#a-miners-panel)).
- 👁 **View** opens its detail panel, the same as on the
  [dashboard]({{ '/en/dashboard.html' | relative_url }}).
- ⏸ **Disable**, once confirmed: the miner leaves the dashboard and stops
  being polled — no more readings, alerts or scheduled tasks. Its
  configuration and history are kept; ▶ enables it again.

The **Actions** button unfolds what acts on every miner at once (see
[Actions](#actions)).

![Configured miners]({{ '/assets/images/settings-configured-miners.png' | relative_url }})

### A miner's panel
{: #a-miners-panel }

A click on a miner opens its configuration panel, on the right (full
screen on a phone). A menu, the same as Configuration's, sums up each
section — display name, pool, alert thresholds, scheduler — and the one
picked shows next to it, with its own **Save** button.

#### Display name

The name the miner goes by everywhere in the dashboard; empty, its
hostname. A new detection never changes it.

#### Pool

The miner's primary and fallback pools (URL, port, user). **Swap primary
and fallback** exchanges the two before saving. When these pools differ
from the feeder's last reading, a warning says so above them, with the
time of that reading, and an orange dot marks the menu's **Pool** entry.

![A miner's pool]({{ '/assets/images/settings-alias-pools.png' | relative_url }})

#### Alert thresholds

This miner's own temperature and fan thresholds — handy for a model that
naturally runs hotter or with a higher fan. An empty field follows every
miner's thresholds (see [System](#system)), shown greyed out. Under each
threshold, the same gauge as in System, plus the miner's current reading
(the dot): green up to back to normal, yellow up to the threshold, red
past it.

![A miner's alert thresholds]({{ '/assets/images/settings-miner-alert-thresholds.png' | relative_url }})

#### Scheduler

Schedules a pool switch or a restart on a cron schedule. Each task shows
its action, when it runs in words and its cron expression; while typing
a new one, the plain-words preview and the next runs show under the
field.

![Scheduler]({{ '/assets/images/settings-schedule.png' | relative_url }})

### Actions
{: #actions }

The **Actions** button, at the top of the list, unfolds the actions on
every enabled miner at once.

![Actions]({{ '/assets/images/settings-miners-actions.png' | relative_url }})

#### Switch to a pool

The menu lists the pools the miners hold right now, each with how many
miners mine on it out of how many hold it. Once confirmed, every miner
that has the chosen pool switches to it, whichever slot holds it
(primary or fallback), then restarts; those already on it or without it
stay as they are. The summary shows at the bottom left, and each switched
miner gets its entry in the [audit]({{ '/en/audit.html' | relative_url }}),
with the pool it left and the one it joined.

#### Check the pools

Asks every miner and compares its two pools (URL, port, user) with the
ones saved in the dashboard. The report gives, for each miner, its name
and alias, its IP and MAC, then its primary and fallback pools as the
miner holds them: ✅ when the dashboard has the same, ❌ otherwise, with
each field that differs. A miner that doesn't answer, or whose MAC isn't
the one saved, is **not read**. **Sync** saves in the dashboard the
pools of the miners to fix.

![Pool check]({{ '/assets/images/settings-miners-check.png' | relative_url }})

---

## ⚡ Electricity
{: #electricity }

The electricity rate (€/kWh) is used to estimate the daily cost shown on
the home screen.

Below the rate, **Other devices** lets you declare the equipment running
alongside the miners (fan, router...) with its power in watts, assumed
constant, to estimate the whole installation's daily cost. A device is
saved as soon as it's added or removed.

![Electricity]({{ '/assets/images/settings-electricity.png' | relative_url }})

---

## ✉️ Notifications
{: #notifications }

Sending mails: the server they go out through, to whom, the audit report
and the alerts. Every mail goes out from the **mailer**, a service of its own
running alongside the feeder (see [Installation]({{ '/en/installation.html#config-file' | relative_url }})).

![Notifications]({{ '/assets/images/settings-notifications.png' | relative_url }})

### SMTP server

The server mails go out through: host, port, security (**STARTTLS**,
**TLS** or **none** — the usual port is offered on each change), username
and password if it needs them, and the sender address.

The password is never shown again: left empty on save, the one already
saved is kept.

### Recipients

The addresses receiving the mails, added under the list and saved right
away.

Just below, the **mails' language** (French or English) and the
**dashboard's address**, used for the links in the mails — prefilled
with the address the page is open at.

Below, **Send a test mail** mails the recipients through the **saved**
server, to check everything works — the mailer included. A small
notification confirms it went out; on a failure, it gives the SMTP
server's reason, with a button to copy it. While no mail can go out, the
send buttons are greyed out and a banner at the top of the section says
what's missing.

### Audit report

A mail summing up the [audit]({{ '/en/audit.html' | relative_url }})
since the previous one, grouped by type:

- **Frequency** — every day, every 2 days, every week (Monday to Sunday)
  or every month; sent around 1 a.m. (UTC), the period it covers having
  just closed.
- **Types** — all by default, or only the ones picked.
- **Send nothing if nothing happened** — skips an empty period.

Below the setting, when it was last sent, or the last failure with its
reason — a failure is retried every hour. Each report sent, or failing,
also shows in the audit.

**Send an example** mails the recipients a made-up audit report on the
day before, whatever the types picked, to see what it looks like without
waiting for the night.

### Alerts

**Send a mail on every new alert**: on every feeder poll that raises new
[alerts]({{ '/en/alerts.html' | relative_url }}), one mail holds them all
— once per alert, when it starts, and nothing when it ends. A firmware
update available is mailed once, not every day. The switch saves itself;
the alerts raised before don't go out.

**Send an example** mails the recipients an alerts mail with made-up
alerts, to see what it looks like.

Below the setting, when the last mail went out, or the last failure with
its reason — a failure shows in the audit too (a mail sent doesn't).
Turning the setting on or off shows in the audit too.

### Mails' texts

{% raw %}
Each mail's subject and text are in editable files, in the
`mail-templates/` folder next to `dashboard.yml` — one file per mail and
language:

```text
mail-templates/
├── alert.fr.html
├── alert.en.html
├── audit-report.fr.html
├── audit-report.en.html
├── test-mail.fr.txt
└── test-mail.en.txt
```

The mailer creates the missing ones when it starts and never touches an
existing file; it reads them again on every send, no restart needed. To
go back to the original text, delete the file: it's created again the next
time the mailer starts.

**The alerts mail and the audit report are HTML**: a header with the
logo, a card per alert or per event, a button to the Alerts or Audit page,
and a footer.

- They're Go templates (`{{.Field}}`, `{{range ...}}`...) whose `<title>`
  tag is the mail's subject; their variables are described at the top of
  the file.
- If they don't work, the built-in template is used and the error is in
  the mailer's logs.
- A text version is attached automatically for the mail clients that
  don't show HTML.
- The button only shows when the dashboard's address is a name, not an
  IP, and the address itself is never written in the HTML: a link to an IP
  — even written out as text, which Gmail turns into a link — gets the mail
  flagged as spam.

**The test mail is plain text**, to check the sending with no layout:

```text
# Lines starting with # are comments
Subject: AxeOS Dashboard — test mail

Good news: AxeOS Dashboard can send mails.

  • SMTP server: {{server}} ({{security}})
  • Recipients: {{to}}

Dashboard: {{dashboardURL}}
```

- The `Subject:` line is the mail's subject; after the blank line, its
  text.
- Each `{{variable}}` is replaced on sending — the list is in comments at
  the top of the file.
- A line whose variable is empty disappears (the address, with no
  dashboard address).
{% endraw %}

---

## ☁️ Remote (hashboard.live)
{: #remote }

Pushing your miners' stats to [hashboard.live](https://hashboard.live), to
follow your fleet from anywhere, no VPN needed.

![Remote (hashboard)]({{ '/assets/images/settings-remote.png' | relative_url }})

- **Your board** — once the push is set up: the board ID (click to open
  it), whether it's public or private, when hashboard last received data,
  how many miners of your fleet it holds out of its limit — with the ones
  past it, not sent — and a link to your account.
- **Connection** — the push URL and your hashboard API key, then
  **Save**. A blank URL turns the push off. If hashboard refuses the key
  or doesn't answer, an alert says so here (with an orange dot on the
  menu's **Remote** entry); for a refused key, it links to your Remote
  page on hashboard, where the new one is.
- **Remote actions** — from your private board, you can restart a miner
  or switch it to its other pool. One switch for the restart, one for the
  pool switch: only the actions allowed show on the board. The dashboard
  picks the request up within a minute, does it, and records it in the
  audit (service *Board*, with the IP it was asked from). A third
  switch sends a mail on every action, through the Notifications' SMTP
  server; **Test** sends an example of it, once the server and a recipient
  are set.
- **Your data protection** — your wallet, your pools and your miners' IP
  are obfuscated before the push: hashboard doesn't receive them. One
  switch per piece of data to share it anyway; each saves on click and
  shows its state: *Private — never sent*, *Masked — made-up address*
  (the IP), or *Shared with hashboard*.

Each change is recorded in the audit, under *Remote push changed*.

[See data protection →]({{ '/en/hashboard.html#data-protection' | relative_url }}){: .btn .btn-primary }

---

## ⚙️ System
{: #system }

### Alert thresholds

An alert is raised when the chip temperature or the fan speed goes above
its threshold, and ends once the reading is back under the threshold minus
its **return margin**: a reading hovering around the threshold doesn't
raise an alert on every poll. The thresholds set here apply to every
miner — each can have its own in its [panel](#a-miners-panel) — and the
return margins to all. Empty, they're the built-in values: 62 °C and
75 %, with margins of 2 °C and 5 %.

Under each measure, a gauge shows the three zones — green up to back to
normal, yellow up to the threshold (marked by a tick), red past it — and
the back-to-normal value.

![Alert thresholds]({{ '/assets/images/settings-alert-thresholds.png' | relative_url }})

### Pool dashboards

Some pools already have a clickable link built in (Braiins, Atlas...).
For a pool the app doesn't natively recognize, you can add your own
mapping between its hostname and its dashboard URL, with `{user}` as a
placeholder for the stratum user's account part — the link then becomes
clickable in the list and details of the miners using that pool.

Only the pools added by hand show at first: **Show the built-in pools**
unfolds the others. A URL too long is cut short, and shows whole on hover
(or on a tap on a phone).

![Pool dashboards]({{ '/assets/images/settings-pools.png' | relative_url }})

### Firmware repos

Where the dashboard checks each model's latest firmware version (a GitHub
release) — built into the app, shown read-only.

![Firmware repos]({{ '/assets/images/settings-firmware.png' | relative_url }})
