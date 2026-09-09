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
  - title: Paramétrage
    anchor: parametrage
---

# Installation

<div class="toc-grid">
  <a href="#docker" class="toc-card">
    <span class="toc-card-icon">🐳</span>
    <span class="toc-card-title">Docker</span>
  </a>
  <a href="#parametrage" class="toc-card">
    <span class="toc-card-icon">⚙️</span>
    <span class="toc-card-title">Paramétrage</span>
  </a>
</div>

## 🐳 Docker
{: #docker }

<div class="text-toc">
  <a href="#docker-installation">Installation</a><span class="text-toc-sep">·</span><a href="#docker-structure">Structure</a><span class="text-toc-sep">·</span><a href="#docker-lancement">Lancement</a><span class="text-toc-sep">·</span><a href="#docker-maj">Mise à jour</a>
</div>

### Installation
{: #docker-installation }

- **Docker** installé et démarré sur la machine cible.
- C'est tout — pas de configuration manuelle de nginx ou systemd, pas de
  fichier de config à écrire à la main.

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

Elle peut être relancée sans risque plus tard — elle n'écrase jamais un
`config/dashboard.yml` existant, ni le fichier `.env` qui mémorise le
port et la version choisis (`HTTP_PORT`/`IMAGE_TAG`) d'un lancement à
l'autre.

{: .note }
> 💡 **Astuce** — épinglez une version précise au lieu de `latest` avec
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

Arborescence créée dans le dossier où la commande a été lancée :

```text
axeos-dashboard/
├── docker-compose.yml
├── .env
├── config/
│   └── dashboard.yml
└── storage/            # rempli une fois le feeder lancé
    ├── logs/
    │   ├── dashboard-api.log
    │   └── feeder.log
    └── data/
        ├── bitaxes/
        │   └── <mac>/
        │       ├── latest.json
        │       └── AAAA-MM-JJ.jsonl
        └── firmware_cache.json
```

### Lancement
{: #docker-lancement }

Ouvrez [http://localhost:81/](http://localhost:81/){:target="_blank"} (le
port de l'exemple ci-dessus), puis :

[Détection automatique des mineurs]({{ '/configuration.html#detection-automatique' | relative_url }}){: .btn .btn-primary }

### Mise à jour
{: #docker-maj }

Relancez exactement la même commande d'installation, ou depuis le dossier
`axeos-dashboard/` :

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
> Un script `native-install.sh` va être déployé pour faciliter
> l'installation des différents services.

---

## ⚙️ Paramétrage
{: #parametrage }

`dashboard.yml` est un fichier statique, lu **une seule fois au
démarrage** — toute modification nécessite de **redémarrer** les
binaires pour être prise en compte.

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

- **global.env** — `dev` affiche les logs uniquement sur la console ;
  toute autre valeur écrit aussi des fichiers de log.
- **server.port** — port d'écoute de dashboard-api.
- **storage.dataDir** — dossier racine des données (mineurs, historique,
  cache firmware).
- **feeder.interval** — fréquence de sondage de chaque mineur.
- **healthCheck.interval** — fréquence de la vérification de
  joignabilité.
- **endpoints** — chemins des endpoints appelés sur chaque mineur
  (lecture, écriture pool, redémarrage).
- **firmware.cacheTTL** — durée de mise en cache de la réponse GitHub
  "dernière version".

{: .note }
> Le tarif électrique, les pools et la liste des mineurs se gèrent
> directement depuis l'app (page **Configuration**) — pas besoin
> d'éditer de fichier à la main pour ça.

[Aller à Configuration →]({{ '/configuration.html#electricite-pools' | relative_url }}){: .btn .btn-primary }
