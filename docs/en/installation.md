---
title: Installation
nav_order: 2
lang: en
subnav:
  - title: Docker
    anchor: docker
    subnav:
      - title: Installation
        anchor: docker-installation
      - title: Structure
        anchor: docker-structure
      - title: Startup
        anchor: docker-startup
      - title: Update
        anchor: docker-update
  - title: Native
    anchor: native
  - title: Configuration file
    anchor: config-file
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#docker" class="toc-card">
    <span class="toc-card-icon">🐳</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Docker</span>
      <span class="toc-card-sub">The simplest: everything runs in containers</span>
    </span>
  </a>
  <a href="#native" class="toc-card">
    <span class="toc-card-icon">💻</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Native</span>
      <span class="toc-card-sub">Straight on the machine, with systemd</span>
    </span>
  </a>
  <a href="#config-file" class="toc-card">
    <span class="toc-card-icon">⚙️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Configuration file</span>
      <span class="toc-card-sub">The <code>dashboard.yml</code> file, common to both</span>
    </span>
  </a>
</div>

## 🐳 Docker
{: #docker }

<div class="text-toc">
  <a href="#docker-installation">Installation</a><span class="text-toc-sep">·</span><a href="#docker-structure">Structure</a><span class="text-toc-sep">·</span><a href="#docker-startup">Startup</a><span class="text-toc-sep">·</span><a href="#docker-update">Update</a>
</div>

### Installation
{: #docker-installation }

With Docker on the machine, one command is enough. `IMAGE_TAG` picks the
version: a release (`1.0.0`) or `latest`, the very last one.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | IMAGE_TAG=1.0.0 HTTP_PORT=81 bash</span>

<span class="term-comment">&gt;&gt;&gt; Image tag: 1.0.0</span>
 ✔ Container axeos-services    Started
 ✔ Container axeos-dashboard   Started
<span class="term-comment">&gt;&gt;&gt; Done. Open http://&lt;this-machine-ip&gt;:&lt;port&gt;/ from any device on your LAN</span></pre>
</div>

Running the command again keeps your configuration and the chosen port.

### Structure
{: #docker-structure }

The folder created where you ran the command:

```text
axeos-dashboard/
├── docker-compose.yml
├── .env
├── config/
│   ├── dashboard.yml
│   └── mail-templates/  # the mails' texts, created by the mailer
└── storage/            # filled once the services run
    ├── logs/
    │   ├── dashboard-api.log
    │   ├── feeder.log
    │   └── mailer.log
    └── data/
        ├── bitaxes/
        │   └── <mac>/
        │       ├── latest.json
        │       └── YYYY-MM-DD.jsonl
        ├── audit/
        ├── mail/
        └── firmware_cache.json
```

### Startup
{: #docker-startup }

Open [http://localhost:81/](http://localhost:81/){:target="_blank" rel="noopener noreferrer"}
and start detecting your miners.
[Automatic detection]({{ '/en/configuration.html#automatic-detection' | relative_url }}){: .link-page }

### Update
{: #docker-update }

Run the installation command again, or from `axeos-dashboard/`:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ docker compose pull &amp;&amp; docker compose up -d</span></pre>
</div>

---

## 💻 Native
{: #native }

The release's binaries, started by systemd. In the folder the services will
run from, as a user with `sudo`:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ mkdir ~/axeos-dashboard && cd ~/axeos-dashboard</span>
<span class="term-command">$ curl -fLO https://github.com/joakim-ribier/axeos-dashboard/releases/latest/download/Makefile</span>
<span class="term-command">$ make install</span></pre>
</div>

`make install` installs the latest stable version, writes `config.yml` when
there's none, starts the feeder, dashboard-api and the mailer as your user,
and adds the `axeos-*` shortcuts. A given version:
`make install RELEASE_TAG=1.0.0`.

At the end, it prints the two nginx commands to run — nginx serves the
interface and relays the API — and the `chmod o+x` when a folder on the
path is closed to it.

To update: `make update`, or `axeos-update`.
[Makefile › Server]({{ '/en/makefile.html#server' | relative_url }}){: .link-page }

---

## ⚙️ Configuration file
{: #config-file }

`dashboard.yml` is read at startup: restart the services after a change.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">dashboard.yml</span>
  </div>
  <pre class="terminal-card-body">global:
  env: dev

server:
  port: "8080"

mailer:
  port: "8082"

storage:
  dataDir: resources

feeder:
  interval: 2m

healthCheck:
  interval: 15s

endpoints:
  timeout: 5s
  info:    api/system/info
  system:  api/system
  restart: api/system/restart

firmware:
  cacheTTL: 24h

ui:
  page:
    settings: enabled
    backups: enabled
    audit: enabled</pre>
</div>

- `global.env` — `dev`: logs on the console, neither the audit report nor
  the alerts by mail. Any other value: logs in files too. Every mail's
  subject starts with this value (`[prod]`).
- `server.port` — dashboard-api's port.
- `mailer.port` — the mailer's port, reached on the machine itself.
- `storage.dataDir` — the data folder.
- `feeder.interval` — the time between two polls of the miners.
- `healthCheck.interval` — the time between two checks of the miners.
- `endpoints` — the paths called on each miner.
- `firmware.cacheTTL` — how long the latest firmware version stays cached.
- `ui.page` — for Configuration, Backups and Audit: `hidden` removes the page
  and its menu entry (archiving and the audit go on), `readonly` shows
  Configuration without letting anything be changed.

The rest — miners, electricity, notifications, pools — is set in the app.
[Configuration]({{ '/en/configuration.html' | relative_url }}){: .link-page }

{% include page_nav.html position="bottom" %}
