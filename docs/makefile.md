---
title: Makefile
nav_order: 7
group: Dev
subnav:
  - title: Développement
    anchor: developpement
  - title: Qualité
    anchor: qualite
  - title: Déploiement
    anchor: deploiement
  - title: Serveur
    anchor: serveur
  - title: Releases
    anchor: releases
---

# Makefile

<div class="toc-grid">
  <a href="#developpement" class="toc-card">
    <span class="toc-card-icon">🛠️</span>
    <span class="toc-card-title">Développement</span>
  </a>
  <a href="#qualite" class="toc-card">
    <span class="toc-card-icon">✅</span>
    <span class="toc-card-title">Qualité</span>
  </a>
  <a href="#deploiement" class="toc-card">
    <span class="toc-card-icon">🚀</span>
    <span class="toc-card-title">Déploiement</span>
  </a>
  <a href="#serveur" class="toc-card">
    <span class="toc-card-icon">🖥️</span>
    <span class="toc-card-title">Serveur</span>
  </a>
  <a href="#releases" class="toc-card">
    <span class="toc-card-icon">🏷️</span>
    <span class="toc-card-title">Releases</span>
  </a>
</div>

Toutes les commandes du projet, de la machine de développement au serveur.

`make` tout seul les liste, rangées par section, chacune avec l'endroit où
elle se lance :

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
  latest-update          on the server: install the latest GitHub release, then restart
  ...</pre>
</div>

## 🛠️ Développement
{: #developpement }

Sur votre machine. `make run` compile les binaires puis lance toute la
stack dans la console : mailer, feeder, dashboard-api et l'interface sur
le port 5174. Chaque ligne est préfixée par le processus d'où elle vient,
et Ctrl+C arrête tout.

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

Un service seul, à partir du dernier build (`make build`) :
`make run-dashboard-api`, `make run-feeder`, `make run-mailer`, ou
`make run-dashboard-ui` pour l'interface seule. Toutes lisent
`resources/dashboard.yml`, ou le fichier donné par `CONFIG=` :

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make run-feeder CONFIG=resources/autre.yml</span></pre>
</div>

`make docker` construit les images Docker à partir du code local et
démarre la stack : voir [Docker](dev.html#build).

`make rebuild-totals` reconstruit les compteurs cumulés depuis
l'historique : voir [Scripts](rebuild-totals.html#rebuild-totals).

## ✅ Qualité
{: #qualite }

<table class="data-table">
  <thead>
    <tr>
      <th>Commande</th>
      <th>Ce qu'elle fait</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>make lint</code></td>
      <td>golangci-lint sur tout le code Go</td>
    </tr>
    <tr>
      <td><code>make test</code></td>
      <td>les tests Go, avec le détecteur de concurrence et la couverture</td>
    </tr>
    <tr>
      <td><code>make swagger</code></td>
      <td>régénère la spécification OpenAPI, et la page <a href="api.html">API</a></td>
    </tr>
    <tr>
      <td><code>make docs</code></td>
      <td>cette documentation en local, reconstruite à chaque modification</td>
    </tr>
  </tbody>
</table>

## 🚀 Déploiement
{: #deploiement }

De votre machine vers votre serveur, sans passer par une release : pour
essayer une modification avant de la publier.

Le serveur se décrit en trois valeurs : son alias SSH, l'utilisateur sous
lequel tournent les services et son dossier. `make init` les demande une à
une et les écrit dans `Makefile.local`, à côté du Makefile (non versionné).
Entrée garde la valeur proposée. Les valeurs remplacées restent en
commentaire, datées :

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

`make deploy` compile pour le Raspberry Pi (linux/arm64), construit
l'interface et copie le tout sur le serveur, avec le Makefile et
`Makefile.local`. Rien n'est redémarré : `make restart` sur le serveur
ensuite.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-comment"># sur votre machine</span>
<span class="term-command">$ make deploy</span>
<span class="term-comment"># puis sur le serveur, dans son dossier</span>
<span class="term-command">$ make restart</span></pre>
</div>

## 🖥️ Serveur
{: #serveur }

Sur le serveur lui-même, dans son dossier : tout ce qu'il fait tourner est
dans `dist/`.

<table class="data-table">
  <thead>
    <tr>
      <th>Commande</th>
      <th>Ce qu'elle fait</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>make install-services</code></td>
      <td>installe et active les services systemd (la première fois, et quand ils changent), plus les raccourcis <code>axeos-*</code></td>
    </tr>
    <tr>
      <td><code>make restart</code></td>
      <td>redémarre mailer, feeder et dashboard-api</td>
    </tr>
    <tr>
      <td><code>make latest-update</code></td>
      <td>installe la release <code>latest</code>, puis redémarre</td>
    </tr>
  </tbody>
</table>

`make latest-update` télécharge les binaires de l'architecture du serveur
(arm64 ou amd64, détectée seule), depuis la release `latest` : le dernier
commit de `main`. Si un téléchargement échoue, rien n'est remplacé.

## 🏷️ Releases
{: #releases }

De n'importe où : `make versions` liste les releases publiées sur GitHub,
le commit de `latest` puis chaque version, de la plus récente à la plus
ancienne.

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make versions</span>
latest    e72f5e3
releases  v0.2.0 v0.1.0</pre>
</div>
