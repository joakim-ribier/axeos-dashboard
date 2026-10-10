---
title: Audit
nav_order: 6.5
group: Pages
subnav:
  - title: Événements enregistrés
    anchor: evenements
  - title: Contenu d'une entrée
    anchor: entree
  - title: Stockage et API
    anchor: stockage
  - title: Masquer la page
    anchor: masquer
---

# Audit

<div class="toc-grid">
  <a href="#evenements" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-title">Événements enregistrés</span>
  </a>
  <a href="#entree" class="toc-card">
    <span class="toc-card-icon">🔎</span>
    <span class="toc-card-title">Contenu d'une entrée</span>
  </a>
  <a href="#stockage" class="toc-card">
    <span class="toc-card-icon">🗄️</span>
    <span class="toc-card-title">Stockage et API</span>
  </a>
  <a href="#masquer" class="toc-card">
    <span class="toc-card-icon">🙈</span>
    <span class="toc-card-title">Masquer la page</span>
  </a>
</div>

L'historique de tout ce qui modifie un mineur ou la configuration, sort
des données du Pi ou scanne le réseau, que ce soit depuis le dashboard ou
par le planificateur.

![Page Audit]({{ '/assets/images/audit.png' | relative_url }})

La page affiche les **dernières 24 heures** par défaut, du plus récent au
plus ancien. Le calendrier affiche une autre journée, de minuit à minuit
à l'heure locale.

- **Filtres** — par mineur, par type d'événement et par jour. Chaque
  filtre actif apparaît en étiquette sous la barre : la croix le retire,
  **Tout effacer** les retire tous. Le nombre d'événements de la période
  s'affiche à droite.
- **Une ligne par événement** — un point vert si l'opération a réussi,
  rouge si elle a échoué, suivi du type d'événement et du mineur
  concerné. En dessous :
  - pour une opération faite depuis le dashboard : l'heure, l'adresse IP
    et le navigateur de l'appareil (le détail complet au survol) ;
  - pour une opération du planificateur : l'heure et l'expression cron qui
    l'a déclenchée ;
  - en cas d'échec, le code d'erreur et le message.
- **Copier** — l'icône en bout de ligne copie l'entrée complète, au
  format JSON.
- **Exporter** — télécharge toutes les entrées de la période et des
  filtres en cours (pas seulement la page affichée) dans un fichier JSON.

---

## 📋 Événements enregistrés
{: #evenements }

Seules les actions déclenchées depuis le dashboard ou par le planificateur
sont enregistrées, qu'elles réussissent ou échouent : les modifications,
les données qui sortent du Pi (exports, sauvegardes) et les scans du
réseau.

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Libellé</th>
      <th>Depuis le dashboard</th>
      <th>Par le planificateur</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>restart</code></td>
      <td>Redémarrage</td>
      <td><code>POST /api/miners/{hostnameOrIp}/restart</code></td>
      <td>✅</td>
    </tr>
    <tr>
      <td><code>switch_primary</code></td>
      <td>Bascule vers le pool principal</td>
      <td><code>PUT /api/miners/pool/primary/enable</code></td>
      <td>✅</td>
    </tr>
    <tr>
      <td><code>switch_fallback</code></td>
      <td>Bascule vers le pool de secours</td>
      <td><code>PUT /api/miners/pool/fallback/enable</code></td>
      <td>✅</td>
    </tr>
    <tr>
      <td><code>save_miners</code></td>
      <td>Enregistrement des mineurs</td>
      <td><code>POST /api/config/miners</code></td>
      <td></td>
    </tr>
    <tr>
      <td><code>save_settings</code></td>
      <td>Enregistrement des paramètres</td>
      <td><code>POST /api/config/settings</code></td>
      <td></td>
    </tr>
    <tr>
      <td><code>export_audit</code></td>
      <td>Export de l'audit</td>
      <td><code>GET /api/audit/export</code></td>
      <td></td>
    </tr>
    <tr>
      <td><code>download_backups</code></td>
      <td>Téléchargement de sauvegardes</td>
      <td><code>GET /api/backups/download</code></td>
      <td></td>
    </tr>
    <tr>
      <td><code>discover</code></td>
      <td>Détection réseau</td>
      <td><code>GET /api/config/discover</code></td>
      <td></td>
    </tr>
  </tbody>
</table>

Une bascule de pool appliquée à tous les mineurs à la fois est
enregistrée une seule fois, avec **tous les mineurs** comme cible. Elle
apparaît aussi quand on filtre sur un mineur précis.

---

## 🔎 Contenu d'une entrée
{: #entree }

Une opération faite depuis le dashboard :

```json
{
  "ts": "2026-10-10T07:57:41Z",
  "source": "api",
  "type": "restart",
  "target": "192.168.1.65",
  "ip": "192.168.1.20",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "requestId": "raspberrypi/xzGLtihnkN-000057",
  "status": 204
}
```

Une opération du planificateur, ici en échec :

```json
{
  "ts": "2026-10-09T21:59:59Z",
  "source": "system",
  "service": "scheduler",
  "type": "switch_fallback",
  "target": "192.168.1.65",
  "cron": "59 59 23 * * FRI",
  "error": "switch pool for 192.168.1.65: … connect: connection refused"
}
```

<table class="data-table">
  <thead>
    <tr>
      <th>Champ</th>
      <th>Contenu</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>ts</code></td><td>Date et heure, en UTC</td></tr>
    <tr><td><code>source</code></td><td><code>api</code> (depuis le dashboard) ou <code>system</code> (par l'application elle-même)</td></tr>
    <tr><td><code>type</code></td><td>Le type d'événement — voir le tableau ci-dessus</td></tr>
    <tr><td><code>target</code></td><td>L'IP du mineur concerné — absent pour un enregistrement de configuration ou une bascule sur tous les mineurs</td></tr>
    <tr><td><code>ip</code></td><td><code>api</code> — l'adresse IP de l'appareil qui a fait la demande</td></tr>
    <tr><td><code>userAgent</code></td><td><code>api</code> — le navigateur de cet appareil</td></tr>
    <tr><td><code>requestId</code></td><td><code>api</code> — l'identifiant de la requête, le même que dans les logs du dashboard</td></tr>
    <tr><td><code>status</code></td><td><code>api</code> — le code HTTP de la réponse (400 ou plus : échec)</td></tr>
    <tr><td><code>query</code></td><td><code>api</code> — les paramètres de la demande : les mois téléchargés, la période et les filtres exportés, le mineur ciblé…</td></tr>
    <tr><td><code>service</code></td><td><code>system</code> — la partie de l'application qui a agi : <code>scheduler</code></td></tr>
    <tr><td><code>cron</code></td><td><code>system</code> — l'expression cron qui a déclenché l'opération</td></tr>
    <tr><td><code>error</code></td><td>Le message d'erreur, en cas d'échec</td></tr>
  </tbody>
</table>

---

## 🗄️ Stockage et API
{: #stockage }

Les entrées sont ajoutées dans un fichier par jour (UTC) :
`{dataDir}/data/audit/AAAA-MM-JJ.jsonl` (`./storage/data/audit/` avec
Docker), une entrée JSON par ligne.

Deux routes de l'API les exposent :

- `GET /api/audit` — les entrées entre `from` et `to` (dates RFC 3339,
  les dernières 24 heures par défaut, 7 jours au maximum), filtrables par
  `ip` (mineur) et `type`, paginées avec `page` et `pageSize`.
- `GET /api/audit/export` — mêmes paramètres, sans pagination : le
  fichier JSON du bouton **Exporter**, qui reprend la période et les
  filtres avant la liste des entrées.

```json
{
  "from": "2026-10-09T08:00:00Z",
  "to": "2026-10-10T08:00:00Z",
  "type": "restart",
  "exportedAt": "2026-10-10T08:00:00Z",
  "total": 6,
  "entries": [ … ]
}
```

Le détail des paramètres est sur la page [API]({{ '/api.html' | relative_url }}).

---

## 🙈 Masquer la page
{: #masquer }

La page et son entrée dans le menu se masquent depuis `dashboard.yml`
(redémarrage du dashboard nécessaire). Le dashboard continue
d'enregistrer les événements.

```yaml
ui:
  page:
    audit: hidden   # enabled (par défaut) | hidden
```
