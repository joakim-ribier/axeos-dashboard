---
title: Docker
nav_order: 7.5
group: Dev
lang: en
subnav:
  - title: Build
    anchor: build
---

{% include page_nav.html position="top" %}

## Build
{: #build }

To test the current branch's code (including uncommitted changes)
without going through an image published on GHCR — useful during
development, before opening a pull request:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-comment"># from the repo root</span>
<span class="term-command">$ make docker</span></pre>
</div>

`make docker` runs `docker-build-dev.sh`, which builds the 2 images from
the local code (`docker compose build`) then starts the stack (`docker compose up -d`) — never calling
`docker compose pull`. Config and data land in `./axeos-dashboard/`
(gitignored), so they never mix with the source code. Like the
installer, it never overwrites an existing
`axeos-dashboard/config/dashboard.yml`, and a random port is used by
default (pin one with `HTTP_PORT`):

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make docker HTTP_PORT=8888</span></pre>
</div>

The current commit's SHA is baked into the build (visible via
`GET /api/info`), followed by `-dirty` when changes aren't committed.

Re-running `make docker` after a change rebuilds the images and restarts
the containers with the up-to-date code.

To start from a first install — no miner, no data — `FRESH=1` uses a
new folder under `/tmp` instead of `./axeos-dashboard/`, which stays as it
is for the next `make docker`:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make docker FRESH=1</span></pre>
</div>

The dev stack has its own names, whatever folder it's started from: the
project `axeos-dashboard-dev` and the containers `axeos-dev-services` and
`axeos-dev-dashboard`. It thus runs next to a
Docker install on the same machine. To see it, then stop it:

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ docker compose -p axeos-dashboard-dev ps</span>
<span class="term-command">$ docker compose -p axeos-dashboard-dev down</span></pre>
</div>

{% include page_nav.html position="bottom" %}
