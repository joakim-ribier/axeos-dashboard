---
title: Docker
nav_order: 6
group: Dev
lang: en
subnav:
  - title: Build
    anchor: build
---

# Docker

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
<span class="term-command">$ ./docker-build-dev.sh</span></pre>
</div>

The script builds the 2 images from the local code (`docker compose
build`) then starts the stack (`docker compose up -d`) — never calling
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
  <pre class="terminal-card-body"><span class="term-command">$ HTTP_PORT=8888 ./docker-build-dev.sh</span></pre>
</div>

{: .note }
> 💡 **Tip** — the current commit's SHA is automatically baked into the
> build (visible via `GET /api/miners`), with a `-dirty` suffix if there
> are uncommitted changes.

Re-running the script after a change rebuilds the images and restarts
the containers with the up-to-date code.
