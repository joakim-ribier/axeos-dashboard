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
  - title: Config file
    anchor: config-file
---

# Installation

<div class="toc-grid">
  <a href="#docker" class="toc-card">
    <span class="toc-card-icon">🐳</span>
    <span class="toc-card-title">Docker</span>
  </a>
  <a href="#config-file" class="toc-card">
    <span class="toc-card-icon">⚙️</span>
    <span class="toc-card-title">Config file</span>
  </a>
</div>

## 🐳 Docker
{: #docker }

<div class="text-toc">
  <a href="#docker-installation">Installation</a><span class="text-toc-sep">·</span><a href="#docker-structure">Structure</a><span class="text-toc-sep">·</span><a href="#docker-startup">Startup</a><span class="text-toc-sep">·</span><a href="#docker-update">Update</a>
</div>

### Installation
{: #docker-installation }

- **Docker** installed and running on the target machine.
- That's it — no manual nginx or systemd setup, no config file to write
  by hand.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | HTTP_PORT=81 bash</span>

  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  1174  100  1174    0     0   2541      0 --:--:-- --:--:-- --:--:--  2546
[+] pull 10/10
 ✔ Image ghcr.io/joakim-ribier/axeos-dashboard/axeos-services:latest  Pulled                                                                           12.7s
 ✔ Image ghcr.io/joakim-ribier/axeos-dashboard/axeos-dashboard:latest Pulled                                                                            9.6s
[+] up 3/3
 ✔ Network axeos-dashboard_default Created                                                                                                              0.0s
 ✔ Container axeos-services        Started                                                                                                              0.2s
 ✔ Container axeos-dashboard       Started                                                                                                              0.2s
<span class="term-comment">&gt;&gt;&gt; Done. Open http://&lt;this-machine-ip&gt;:&lt;port&gt;/ from any device on your LAN
    (see the PORTS column below for &lt;port&gt;, unless you passed HTTP_PORT):</span>
NAME              IMAGE                                                          COMMAND                  SERVICE     CREATED                  STATUS                  PORTS
axeos-dashboard   ghcr.io/joakim-ribier/axeos-dashboard/axeos-dashboard:latest   "/docker-entrypoint.…"   dashboard   Less than a second ago   Up Less than a second   0.0.0.0:81->80/tcp, [::]:81->80/tcp
axeos-services    ghcr.io/joakim-ribier/axeos-dashboard/axeos-services:latest    "/entrypoint.sh"         services    Less than a second ago   Up Less than a second</pre>
</div>

Safe to re-run later — it never overwrites an existing
`config/dashboard.yml`, nor the `.env` file that remembers the port and
version you chose (`HTTP_PORT`/`IMAGE_TAG`) from one run to the next.

{: .note }
> 💡 **Tip** — pin a specific version instead of `latest` with
> `IMAGE_TAG`

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | IMAGE_TAG=sha-3e09149 bash</span></pre>
</div>

### Structure
{: #docker-structure }

Directory tree created wherever you ran the command:

```text
axeos-dashboard/
├── docker-compose.yml
├── .env
├── config/
│   └── dashboard.yml
└── storage/            # filled in once the feeder starts running
    ├── logs/
    │   ├── dashboard-api.log
    │   └── feeder.log
    └── data/
        ├── bitaxes/
        │   └── <mac>/
        │       ├── latest.json
        │       └── YYYY-MM-DD.jsonl
        └── firmware_cache.json
```

### Startup
{: #docker-startup }

Open [http://localhost:81/](http://localhost:81/){:target="_blank"} (the
port from the example above), then:

[Automatic miner detection]({{ '/en/configuration.html#automatic-detection' | relative_url }}){: .btn .btn-primary }

### Update
{: #docker-update }

Re-run the exact same install command, or from the `axeos-dashboard/`
folder:

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

{: .note }
> A `native-install.sh` script will be shipped to make installing the
> individual services easier.

---

## ⚙️ Config file
{: #config-file }

`dashboard.yml` is a static file, read **once at startup** — any change
requires **restarting** the binaries to take effect.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">dashboard.yml</span>
  </div>
  <pre class="terminal-card-body">global:
  env: dev

server:
  port: "8080"

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
  cacheTTL: 24h</pre>
</div>

- **global.env** — `dev` only shows logs on the console; any other value
  also writes log files.
- **server.port** — dashboard-api's listening port.
- **storage.dataDir** — root data folder (miners, history, firmware
  cache).
- **feeder.interval** — how often each miner is polled.
- **healthCheck.interval** — how often reachability is checked.
- **endpoints** — endpoint paths called on each miner (read, write pool,
  restart).
- **firmware.cacheTTL** — how long the GitHub "latest version" response
  is cached.

{: .note }
> The electricity rate, pools, and miner list are all managed directly
> from the app (**Configuration** page) — no need to hand-edit a file
> for that.

[Go to Configuration →]({{ '/en/configuration.html#electricity-pools' | relative_url }}){: .btn .btn-primary }
