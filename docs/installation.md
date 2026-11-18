---
title: Installation
nav_order: 2
subnav:
  - title: Docker
    anchor: docker
    subnav:
      - title: Installation
        anchor: docker-installation
      - title: Structure
        anchor: docker-structure
      - title: Lancement
        anchor: docker-lancement
      - title: Mise à jour
        anchor: docker-maj
  - title: Native
    anchor: native
  - title: Paramétrage
    anchor: parametrage
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#docker" class="toc-card">
    <span class="toc-card-icon">🐳</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Docker</span>
      <span class="toc-card-sub">Le plus simple : tout tourne en conteneurs</span>
    </span>
  </a>
  <a href="#native" class="toc-card">
    <span class="toc-card-icon">💻</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Native</span>
      <span class="toc-card-sub">Directement sur la machine, avec systemd</span>
    </span>
  </a>
  <a href="#parametrage" class="toc-card">
    <span class="toc-card-icon">⚙️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Paramétrage</span>
      <span class="toc-card-sub">Le fichier <code>dashboard.yml</code>, commun aux deux</span>
    </span>
  </a>
</div>

## 🐳 Docker
{: #docker }

<div class="text-toc">
  <a href="#docker-installation">Installation</a><span class="text-toc-sep">·</span><a href="#docker-structure">Structure</a><span class="text-toc-sep">·</span><a href="#docker-lancement">Lancement</a><span class="text-toc-sep">·</span><a href="#docker-maj">Mise à jour</a>
</div>

### Installation
{: #docker-installation }

Avec Docker sur la machine, une commande suffit. `IMAGE_TAG` choisit la
version : une release (`1.0.0`) ou `latest`, la toute dernière.

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

Relancer la commande garde ta configuration et le port choisi.

### Structure
{: #docker-structure }

Le dossier créé là où tu as lancé la commande :

```text
axeos-dashboard/
├── docker-compose.yml
├── .env
├── config/
│   ├── dashboard.yml
│   └── mail-templates/  # textes des mails, créés par le mailer
└── storage/            # rempli une fois les services lancés
    ├── logs/
    │   ├── dashboard-api.log
    │   ├── feeder.log
    │   └── mailer.log
    └── data/
        ├── bitaxes/
        │   └── <mac>/
        │       ├── latest.json
        │       └── AAAA-MM-JJ.jsonl
        ├── audit/
        ├── mail/
        └── firmware_cache.json
```

### Lancement
{: #docker-lancement }

Ouvre [http://localhost:81/](http://localhost:81/){:target="_blank" rel="noopener noreferrer"}
et lance la détection de tes mineurs.
[Détection automatique]({{ '/configuration.html#detection-automatique' | relative_url }}){: .link-page }

### Mise à jour
{: #docker-maj }

Relance la commande d'installation, ou depuis `axeos-dashboard/` :

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

Les binaires de la release, démarrés par systemd. Dans le dossier d'où
tourneront les services, avec un utilisateur qui a `sudo` :

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ mkdir ~/axeos-dashboard && cd ~/axeos-dashboard</span>
<span class="term-command">$ curl -fLO https://github.com/joakim-ribier/axeos-dashboard/releases/latest/download/Makefile</span>
<span class="term-command">$ make install</span></pre>
</div>

`make install` installe la dernière version stable, écrit `config.yml`
s'il n'existe pas, démarre le feeder, dashboard-api et le mailer sous ton
utilisateur, et ajoute les raccourcis `axeos-*`. Une version précise :
`make install RELEASE_TAG=1.0.0`.

À la fin, il affiche les deux commandes nginx à lancer, qui sert
l'interface et relaie l'API — et le `chmod o+x` si un dossier du chemin
lui est fermé.

Pour mettre à jour : `make update`, ou `axeos-update`.
[Makefile › Serveur]({{ '/makefile.html#serveur' | relative_url }}){: .link-page }

---

## ⚙️ Paramétrage
{: #parametrage }

`dashboard.yml` est lu au démarrage : redémarre les services après une
modification.

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

- `global.env` — `dev` : logs dans la console, ni rapport d'audit ni
  alertes par mail. Toute autre valeur : logs aussi dans des fichiers.
  L'objet des mails commence par cette valeur (`[prod]`).
- `server.port` — le port de dashboard-api.
- `mailer.port` — le port du mailer, joint sur la machine elle-même.
- `storage.dataDir` — le dossier des données.
- `feeder.interval` — l'intervalle entre deux relevés des mineurs.
- `healthCheck.interval` — l'intervalle de la vérification des mineurs.
- `endpoints` — les chemins appelés sur chaque mineur.
- `firmware.cacheTTL` — combien de temps la dernière version firmware
  reste en cache.
- `ui.page` — pour Configuration, Sauvegardes et Audit : `hidden` retire la
  page et son entrée du menu (l'archivage et l'audit continuent), `readonly`
  affiche Configuration sans rien laisser modifier.

Le reste — mineurs, électricité, notifications, pools — se règle dans
l'app.
[Configuration]({{ '/configuration.html' | relative_url }}){: .link-page }

{% include page_nav.html position="bottom" %}
