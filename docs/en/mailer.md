---
title: Mailer
nav_order: 6.8
group: Services
lang: en
subnav:
  - title: Its role
    anchor: role
  - title: The mails
    anchor: mails
  - title: Dev instance
    anchor: dev
  - title: Mails' texts
    anchor: texts
  - title: Logs and shutdown
    anchor: logs
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#role" class="toc-card">
    <span class="toc-card-icon">🎯</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Its role</span>
      <span class="toc-card-sub">A service of its own, on the machine</span>
    </span>
  </a>
  <a href="#mails" class="toc-card">
    <span class="toc-card-icon">✉️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">The mails</span>
      <span class="toc-card-sub">Which, when, asked by whom</span>
    </span>
  </a>
  <a href="#dev" class="toc-card">
    <span class="toc-card-icon">🧪</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Dev instance</span>
      <span class="toc-card-sub">What it doesn't send</span>
    </span>
  </a>
  <a href="#texts" class="toc-card">
    <span class="toc-card-icon">📝</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Mails' texts</span>
      <span class="toc-card-sub">Editing them</span>
    </span>
  </a>
  <a href="#logs" class="toc-card">
    <span class="toc-card-icon">📜</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Logs and shutdown</span>
      <span class="toc-card-sub">Where it writes, how it stops</span>
    </span>
  </a>
</div>

The service sending every mail of the dashboard, through your SMTP server.

## 🎯 Its role
{: #role }

A service of its own, next to the feeder and dashboard-api: a slow or
unreachable SMTP server holds up neither the polls nor the interface.

- Its API — on the machine itself (`127.0.0.1`, port `mailer.port`, 8082 by
  default). The feeder and dashboard-api hand it the mails to send.
- A single mailer — when its port is already taken, it stops right away: two
  mailers would send every report twice.
- Its state — in *Platform status*, at the bottom of the menu, with its last
  run.

[Installation › Configuration file]({{ '/en/installation.html#config-file' | relative_url }}){: .link-page }

---

## ✉️ The mails
{: #mails }

| Mail | When | Asked by |
|---|---|---|
| Audit report | around 1 a.m. (UTC), when the chosen period has just closed; a failure is retried every hour | the mailer itself, checking every minute |
| Alerts | if you turn it on, on every poll raising new alerts, all of them in one mail | the feeder |
| Remote action | if you turn it on, on every action asked from your board, done or not | dashboard-api |
| Test mail and examples | on demand, from Configuration | dashboard-api |
{: .data-table }

Every mail's subject starts with the environment that sent it (`global.env`,
e.g. `[prod]`): when several installs write to the same recipient, each mail
says where it comes from.

Each mail's settings are in Configuration, Notifications and Remote.
[Configuration › Notifications]({{ '/en/configuration.html#notifications' | relative_url }}){: .link-page }

---

## 🧪 Dev instance
{: #dev }

When `global.env` is `dev`, the audit report and the alerts mails are left to
the real install: a development instance with the same SMTP settings doesn't
send them a second time. The test mail, the examples and the remote action
mail go out, with `[dev]` at the start of their subject.

---

## 📝 Mails' texts
{: #texts }

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
├── remote-action.fr.html
├── remote-action.en.html
├── remote-action.fr.txt
├── remote-action.en.txt
├── test-mail.fr.txt
└── test-mail.en.txt
```

The mailer creates the missing ones when it starts and never touches an
existing file; it reads them again on every send, no restart needed. To go
back to the original text — or get a new version's —, delete the file: it's
created again the next time the mailer starts.

The alerts mail, the audit report and the remote action mail are HTML: a
header with the logo, a card per alert, per event or for the action, a button
to the Alerts or Audit page, and a footer.

- They're Go templates (`{{.Field}}`, `{{range ...}}`…) whose `<title>`
  tag is the mail's subject; their variables are described at the top of the
  file.
- If they don't work, the built-in template is used and the error is in the
  mailer's logs.
- A text version is attached for mail clients without HTML: generated for
  the alerts mail and the audit report, taken from `remote-action.*.txt` for
  the remote action mail.
- The button only shows when the dashboard's address is a name, not an IP,
  and the address itself is never written in the HTML: a link to an IP —
  even written out as text, which Gmail turns into a link — gets the mail
  flagged as spam.

The test mail is plain text, to check the sending with no layout:

```text
# Lines starting with # are comments
Subject: AxeOS · D#hashboard — test mail

Good news: AxeOS · D#hashboard can send mails.

  • SMTP server: {{server}} ({{security}})
  • Recipients: {{to}}

Dashboard: {{dashboardURL}}
```

- The `Subject:` line is the mail's subject; after the blank line, its text.
- Each `{{variable}}` is replaced on sending — the list is in comments at
  the top of the file.
- A line whose variable is empty disappears (the address, with no dashboard
  address).
{% endraw %}

---

## 📜 Logs and shutdown
{: #logs }

- Logs — in `{dataDir}/logs/mailer.log` (one JSON line per event), or on the
  console when `global.env` is `dev`: every mail sent or failing, with the
  SMTP server's reason.
- Shutdown — cleanly, on `SIGINT` / `SIGTERM`.

{% include page_nav.html position="bottom" %}
