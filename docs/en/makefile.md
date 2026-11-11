---
title: Makefile
nav_order: 7
group: Dev
lang: en
subnav:
  - title: Development
    anchor: development
  - title: Quality
    anchor: quality
  - title: Deploy
    anchor: deploy
  - title: Server
    anchor: server
  - title: Releases
    anchor: releases
---

# Makefile

<div class="toc-grid">
  <a href="#development" class="toc-card">
    <span class="toc-card-icon">🛠️</span>
    <span class="toc-card-title">Development</span>
  </a>
  <a href="#quality" class="toc-card">
    <span class="toc-card-icon">✅</span>
    <span class="toc-card-title">Quality</span>
  </a>
  <a href="#deploy" class="toc-card">
    <span class="toc-card-icon">🚀</span>
    <span class="toc-card-title">Deploy</span>
  </a>
  <a href="#server" class="toc-card">
    <span class="toc-card-icon">🖥️</span>
    <span class="toc-card-title">Server</span>
  </a>
  <a href="#releases" class="toc-card">
    <span class="toc-card-icon">🏷️</span>
    <span class="toc-card-title">Releases</span>
  </a>
</div>

Every command of the project, from the development machine to the server.

`make` alone lists them, by section, each with where it runs:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make</span>
  help                   this list

Development -- on your machine
  run                    the whole stack in this console: mailer, feeder, dashboard-api, UI (:5174) -- Ctrl+C stops it
  run-&lt;service&gt;          one service alone, from the last build (CONFIG=...)
  ...

Server -- on the server itself, in DEPLOY_DIR (everything it runs lives in dist/)
  restart                on the server: restart mailer, feeder and dashboard-api (systemd)
  update                 on the server: install the last vX.Y.Z release (RELEASE_TAG=0.2.0 / latest for another), then restart
  ...</pre>
</div>

## 🛠️ Development
{: #development }

On your machine. `make run` compiles the binaries, then starts the whole
stack in the console: mailer, feeder, dashboard-api and the UI on port
5174. Each line is prefixed with the process it comes from, and Ctrl+C
stops it all.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make run</span>
[mailer] time=... level=INFO msg="Mailer running..."
[feeder] time=... level=INFO msg="Feeder running..."
[api]    time=... level=INFO msg="Server running..."
[ui]       VITE v5.4.21  ready in 139 ms</pre>
</div>

One service alone, from the last build (`make build`):
`make run-dashboard-api`, `make run-feeder`, `make run-mailer`, or
`make run-dashboard-ui` for the UI alone. They all read
`resources/dashboard.yml`, or the file given with `CONFIG=`:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make run-feeder CONFIG=resources/other.yml</span></pre>
</div>

`make docker` builds the Docker images from the local code and starts
the stack: see [Docker](dev.html#build).

`make rebuild-totals` rebuilds the cumulative counters from the history:
see [Scripts](rebuild-totals.html#rebuild-totals).

## ✅ Quality
{: #quality }

<table class="data-table">
  <thead>
    <tr>
      <th>Command</th>
      <th>What it does</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>make lint</code></td>
      <td>golangci-lint on all the Go code</td>
    </tr>
    <tr>
      <td><code>make test</code></td>
      <td>the Go tests, with the race detector and coverage</td>
    </tr>
    <tr>
      <td><code>make swagger</code></td>
      <td>regenerates the OpenAPI spec, and the <a href="api.html">API</a> page</td>
    </tr>
    <tr>
      <td><code>make docs</code></td>
      <td>this documentation locally, rebuilt on every change</td>
    </tr>
  </tbody>
</table>

## 🚀 Deploy
{: #deploy }

From your machine to your server, without a release: to try a change out
before publishing it.

The server comes down to three values: its SSH alias, the user its
services run as and its folder. `make init` asks for each and writes them
into `Makefile.local`, next to the Makefile (not versioned). Enter keeps
the value shown. The values it replaces stay as comments, dated:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make init</span>
SSH alias of the server [server-dev]: pi
User its services run as [debian]:
Its folder [/home/debian/axeos-bitaxe-dashboard]: /home/debian/axeos
>>> Makefile.local written:
DEPLOY_HOST := pi
DEPLOY_USER := debian
DEPLOY_DIR  := /home/debian/axeos

<span class="term-comment"># Replaced on 2026-11-14 10:12:</span>
<span class="term-comment"># DEPLOY_HOST := server-dev</span>
<span class="term-comment"># DEPLOY_USER := debian</span>
<span class="term-comment"># DEPLOY_DIR  := /home/debian/axeos-bitaxe-dashboard</span></pre>
</div>

`make deploy` compiles for the Raspberry Pi (linux/arm64), builds the UI
and copies it all to the server, with the Makefile and `Makefile.local`.
Nothing is restarted: `make restart` on the server afterwards.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-comment"># on your machine</span>
<span class="term-command">$ make deploy</span>
<span class="term-comment"># then on the server, in its folder</span>
<span class="term-command">$ make restart</span></pre>
</div>

## 🖥️ Server
{: #server }

On the server itself, in its folder: everything it runs is in `dist/`.

<table class="data-table">
  <thead>
    <tr>
      <th>Command</th>
      <th>What it does</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>make install-services</code></td>
      <td>installs and enables the systemd services (the first time, and when they change), plus the <code>axeos-*</code> shortcuts</td>
    </tr>
    <tr>
      <td><code>make restart</code></td>
      <td>restarts mailer, feeder and dashboard-api</td>
    </tr>
    <tr>
      <td><code>make update</code></td>
      <td>installs the last release, then restarts</td>
    </tr>
  </tbody>
</table>

`make update` downloads the binaries for the server's architecture (arm64
or amd64, detected on its own). With nothing, the last release; with
`RELEASE_TAG=`, a given version (to stay on it, or go back), or `latest`,
the last commit on `main`. If a download fails, nothing is replaced.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make update</span>
<span class="term-command">$ make update RELEASE_TAG=0.2.0</span>
<span class="term-command">$ make update RELEASE_TAG=latest</span></pre>
</div>

## 🏷️ Releases
{: #releases }

From anywhere: `make versions` lists the releases published on GitHub,
`latest`'s commit then every version, newest first.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make versions</span>
latest    e72f5e3
releases  v0.2.0 v0.1.0</pre>
</div>
