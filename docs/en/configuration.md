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
directly by IP, right next to it.

![Automatic detection]({{ '/assets/images/settings-scan-before.png' | relative_url }})

Miners found appear below, ready to be added to the configuration.

![Detection results]({{ '/assets/images/settings-scan-results.png' | relative_url }})

### Configured miners
{: #configured-miners }

The list of already-configured miners, with their IP, model, alert
thresholds (in color, a miner's own) and status — enable/disable in one
click, per miner or all at once. The eye opens the miner's detail panel,
the same as on the [dashboard]({{ '/en/dashboard.html' | relative_url }}).

![Configured miners]({{ '/assets/images/settings-configured-miners.png' | relative_url }})

#### Name and pools

Clicking a miner expands its editor: display name, and primary /
fallback pool (URL, port, user).

![Name and pools]({{ '/assets/images/settings-alias-pools.png' | relative_url }})

#### Alert thresholds

This miner's own temperature and fan thresholds — handy for a model that
naturally runs hotter or with a higher fan. An empty field follows every
miner's thresholds (see [System](#system)), shown greyed out.

![A miner's alert thresholds]({{ '/assets/images/settings-miner-alert-thresholds.png' | relative_url }})

#### Scheduler

Schedules a pool switch or a restart on a cron schedule.

![Scheduler]({{ '/assets/images/settings-schedule.png' | relative_url }})

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
server's reason, with a button to copy it.

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
  and a link to your account.
- **Connection** — the push URL and your hashboard API key, then
  **Save**. A blank URL turns the push off.
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
its threshold, and ends 2 °C or 5 % under. The thresholds set here apply to
every miner — each can have its own in its row of [Miners](#miners).
Empty, they're the built-in values: 62 °C and 75 %.

![Alert thresholds]({{ '/assets/images/settings-alert-thresholds.png' | relative_url }})

### Pool dashboards

Some pools already have a clickable link built in (Braiins, Atlas...).
For a pool the app doesn't natively recognize, you can add your own
mapping between its hostname and its dashboard URL, with `{user}` as a
placeholder for the stratum user's account part — the link then becomes
clickable in the list and details of the miners using that pool.

![Pool dashboards]({{ '/assets/images/settings-pools.png' | relative_url }})

### Firmware repos

Where the dashboard checks each model's latest firmware version (a GitHub
release) — built into the app, shown read-only.

![Firmware repos]({{ '/assets/images/settings-firmware.png' | relative_url }})
