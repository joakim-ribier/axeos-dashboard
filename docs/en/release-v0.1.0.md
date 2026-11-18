---
title: v0.1.0
nav_order: 11
group: Release
lang: en
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#images" class="toc-card">
    <span class="toc-card-icon">🐳</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Docker images</span>
      <span class="toc-card-sub">The version's two images</span>
    </span>
  </a>
  <a href="#installation" class="toc-card">
    <span class="toc-card-icon">🚀</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Installation</span>
      <span class="toc-card-sub">The command to run</span>
    </span>
  </a>
  <a href="https://github.com/joakim-ribier/axeos-dashboard/releases/tag/v0.1.0" class="toc-card" target="_blank" rel="noopener noreferrer">
    <span class="toc-card-icon">🔗</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Release on GitHub</span>
      <span class="toc-card-sub">Its notes and its files</span>
    </span>
  </a>
</div>

First tagged version of axeos-dashboard, published on September 16, 2026 —
a stable reference point, separate from the `latest` build that follows
every push to `main`.

This version installs with the Docker images: its release has no binaries
for `make update`.

## 🐳 Docker images
{: #images }

<table class="data-table">
  <thead>
    <tr>
      <th>Image</th>
      <th>Contents</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>ghcr.io/joakim-ribier/axeos-dashboard/axeos-services:0.1.0</code></td>
      <td>feeder and dashboard-api</td>
    </tr>
    <tr>
      <td><code>ghcr.io/joakim-ribier/axeos-dashboard/axeos-dashboard:0.1.0</code></td>
      <td>the UI and its reverse proxy</td>
    </tr>
  </tbody>
</table>

## 🚀 Installation
{: #installation }

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | IMAGE_TAG=0.1.0 bash</span></pre>
</div>

`IMAGE_TAG`, the installed structure and updating are detailed on the
Installation page.
[Installation › Docker]({{ '/en/installation.html#docker' | relative_url }}){: .link-page }

{% include page_nav.html position="bottom" %}
