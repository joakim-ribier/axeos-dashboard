---
title: Docker
nav_order: 7.5
group: Dev
subnav:
  - title: Build
    anchor: build
---

# Docker

## Build
{: #build }

Pour tester le code de la branche courante (y compris des changements non
commités) sans passer par une image publiée sur GHCR — utile en
développement, avant d'ouvrir une pull request :

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-comment"># depuis la racine du dépôt</span>
<span class="term-command">$ make docker</span></pre>
</div>

`make docker` lance `docker-build-dev.sh`, qui construit les 2 images à
partir du code local (`docker compose build`) puis démarre la stack (`docker compose up -d`) — sans jamais
appeler `docker compose pull`. Config et données atterrissent dans
`./axeos-dashboard/` (gitignoré), pour ne jamais se mélanger avec le code
source. Comme pour l'installation, il ne réécrit jamais un
`axeos-dashboard/config/dashboard.yml` existant, et un port aléatoire est
utilisé par défaut (fixez-en un avec `HTTP_PORT`) :

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make docker HTTP_PORT=8888</span></pre>
</div>

{: .note }
> 💡 **Astuce** — le SHA du commit courant est automatiquement inclus dans
> le build (visible via `GET /api/info`), avec un suffixe `-dirty` si
> des changements ne sont pas commités.

Relancer `make docker` après une modification reconstruit les images et
redémarre les containers avec le code à jour.

La stack de dev a ses propres noms, quel que soit le dossier d'où elle est
lancée : le projet `axeos-dashboard-dev` et les containers
`axeos-dev-services` et `axeos-dev-dashboard`. Elle tourne donc à côté
d'une [installation Docker](installation.html#docker-installation) sur la
même machine. Pour la voir, puis l'arrêter :

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ docker compose -p axeos-dashboard-dev ps</span>
<span class="term-command">$ docker compose -p axeos-dashboard-dev down</span></pre>
</div>
