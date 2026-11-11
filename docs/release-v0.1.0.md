---
title: v0.1.0
nav_order: 11
group: Release
---

# v0.1.0

<div class="toc-grid">
  <a href="#images" class="toc-card">
    <span class="toc-card-icon">🐳</span>
    <span class="toc-card-title">Images Docker</span>
  </a>
  <a href="#installation" class="toc-card">
    <span class="toc-card-icon">🚀</span>
    <span class="toc-card-title">Installation</span>
  </a>
  <a href="https://github.com/joakim-ribier/axeos-dashboard/releases/tag/v0.1.0" class="toc-card" target="_blank" rel="noopener noreferrer">
    <span class="toc-card-icon">🔗</span>
    <span class="toc-card-title">Release sur GitHub</span>
  </a>
</div>

Première version taguée de axeos-dashboard, publiée le 16 septembre 2026 —
un point de repère stable, distinct du build `latest` qui suit chaque push
sur `main`.

{: .note }
> 🐳 **Docker uniquement** — cette version s'installe seulement avec les
> images Docker : la release n'a pas de binaires pour `make update`.

## 🐳 Images Docker
{: #images }

<table class="data-table">
  <thead>
    <tr>
      <th>Image</th>
      <th>Contenu</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>ghcr.io/joakim-ribier/axeos-dashboard/axeos-services:0.1.0</code></td>
      <td>feeder et dashboard-api</td>
    </tr>
    <tr>
      <td><code>ghcr.io/joakim-ribier/axeos-dashboard/axeos-dashboard:0.1.0</code></td>
      <td>l'interface et son reverse proxy</td>
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

Le détail de `IMAGE_TAG`, de la structure installée et de la mise à jour :
[Installation › Docker](installation.html#docker-installation).
