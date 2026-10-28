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
par l'application elle-même (planificateur, sauvegarde de chaque nuit).

![Page Audit]({{ '/assets/images/audit.png' | relative_url }})

La page affiche les **dernières 24 heures** par défaut, du plus récent au
plus ancien. Le calendrier affiche une autre journée, de minuit à minuit
UTC. Les heures sont en UTC, comme les Sauvegardes et le rapport d'audit
par mail : un même événement porte la même heure partout.

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
  - pour la sauvegarde de chaque nuit : l'heure et le mois mis à jour ;
  - en cas d'échec, le code d'erreur et le message.
- **Copier** — l'icône en bout de ligne copie l'entrée complète, au
  format JSON.
- **Exporter** — télécharge toutes les entrées de la période et des
  filtres en cours (pas seulement la page affichée) dans un fichier JSON.

---

## 📋 Événements enregistrés
{: #evenements }

L'audit trace ce qui a été fait **depuis l'outil** : par quelqu'un dans le
dashboard, ou par l'application elle-même (son planificateur, sa
sauvegarde de chaque nuit). Chaque entrée dit **quoi** (le type),
**quand**, **qui** (l'IP et le navigateur de l'appareil, ou le
planificateur et sa tâche), **sur quoi** (le mineur) et **avec quel
résultat** (réussite, ou échec avec le message d'erreur). Une action qui
échoue est enregistrée aussi.

### ⚙️ Actions sur les mineurs

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Libellé</th>
      <th>D'où</th>
      <th>Ce que l'entrée contient</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>restart</code></td>
      <td>Redémarrage</td>
      <td>panneau d'un mineur › Redémarrer ; ou une tâche du planificateur</td>
      <td>le mineur redémarré</td>
    </tr>
    <tr>
      <td><code>switch_primary</code></td>
      <td>Bascule vers le pool principal</td>
      <td>panneau d'un mineur › Changer de pool ; ou une tâche du planificateur</td>
      <td>le mineur basculé — <strong>tous les mineurs</strong> si la bascule les vise tous (appel direct à l'API)</td>
    </tr>
    <tr>
      <td><code>switch_fallback</code></td>
      <td>Bascule vers le pool de secours</td>
      <td>idem</td>
      <td>idem</td>
    </tr>
  </tbody>
</table>

### 🛠️ Configuration

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Libellé</th>
      <th>D'où</th>
      <th>Ce que l'entrée contient</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>save_miners</code></td>
      <td>Enregistrement des mineurs</td>
      <td>page Configuration : enregistrer la détection, activer / désactiver, tout désactiver, alias, pools, planification</td>
      <td>par mineur modifié, ce qui a changé hors changements sensibles : alias, nom d'hôte, modèle (avant → après). En cas d'échec : une seule entrée, sans mineur</td>
    </tr>
    <tr>
      <td><code>save_settings</code></td>
      <td>Enregistrement des paramètres</td>
      <td>page Configuration › Réglages de l'application : tarif, autres appareils, dashboards de pool, accès distant</td>
      <td>ce qui a changé hors changements sensibles : le tarif (avant → après), les appareils, les dashboards de pool et les dépôts firmware ajoutés ou supprimés. En cas d'échec : une seule entrée</td>
    </tr>
  </tbody>
</table>

### 📤 Données et réseau

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Libellé</th>
      <th>D'où</th>
      <th>Ce que l'entrée contient</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>export_audit</code></td>
      <td>Export de l'audit</td>
      <td>page Audit › Exporter</td>
      <td>la période et les filtres exportés</td>
    </tr>
    <tr>
      <td><code>download_backups</code></td>
      <td>Téléchargement de sauvegardes</td>
      <td>page Sauvegardes › Télécharger</td>
      <td>les mois téléchargés</td>
    </tr>
    <tr>
      <td><code>discover</code></td>
      <td>Détection réseau</td>
      <td>page Configuration › Détection automatique (scan du réseau, ou ajout par IP)</td>
      <td>la plage scannée ou l'IP sondée</td>
    </tr>
    <tr>
      <td><code>backup</code></td>
      <td>Sauvegarde mise à jour</td>
      <td>chaque nuit, par l'application : la journée terminée est ajoutée à l'archive de son mois (voir <a href="{{ '/backups.html' | relative_url }}">Sauvegardes</a>)</td>
      <td>le ou les mois dont l'archive a été mise à jour</td>
    </tr>
    <tr>
      <td><code>audit_report</code></td>
      <td>Rapport d'audit envoyé</td>
      <td>la nuit, par le mailer, selon la fréquence choisie dans Configuration › Notifications</td>
      <td>la période couverte et les destinataires ; l'erreur en cas d'échec</td>
    </tr>
  </tbody>
</table>

### 🔐 Changements sensibles

Un enregistrement de la configuration qui contient des changements
sensibles produit, **à la place** de <code>save_miners</code> ou
<code>save_settings</code>, une entrée dédiée par changement sensible :
une seule écriture par fait, aucune ligne en double. Chaque entrée a son
détail (valeurs **avant → après**, ou la tâche ajoutée ou supprimée), pour
pouvoir la rechercher directement. Un seul enregistrement peut en produire
plusieurs (par exemple le pool **et** la planification d'un mineur).

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Libellé</th>
      <th>Quand</th>
      <th>Détail</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>miner_pool</code></td>
      <td>Pool du mineur modifié</td>
      <td>l'URL, le port ou l'utilisateur du pool principal ou de secours d'un mineur change</td>
      <td>chaque champ modifié — ex. <em>Utilisateur de secours : bc1q…abc.w1 → bc1q…xyz.w1</em></td>
    </tr>
    <tr>
      <td><code>miner_schedule</code></td>
      <td>Planification modifiée</td>
      <td>une tâche planifiée est ajoutée ou supprimée (une tâche n'est jamais modifiée : changer une tâche, c'est en supprimer une et en ajouter une autre)</td>
      <td>chaque tâche ajoutée ou supprimée, écrite en clair — ex. <em>Tâche ajoutée : Redémarrage · À 00:00, uniquement le mercredi (0 0 0 * * WED)</em></td>
    </tr>
    <tr>
      <td><code>miner_identity</code></td>
      <td>IP du mineur modifiée</td>
      <td>l'IP d'un mineur déjà configuré change (le mineur est reconnu par sa MAC)</td>
      <td>l'ancienne et la nouvelle IP</td>
    </tr>
    <tr>
      <td><code>miner_disabled</code> / <code>miner_enabled</code></td>
      <td>Mineur désactivé / activé</td>
      <td>un mineur est désactivé (il n'est plus surveillé ni planifié) ou réactivé</td>
      <td>—</td>
    </tr>
    <tr>
      <td><code>miner_added</code></td>
      <td>Mineur ajouté</td>
      <td>un mineur entre dans la configuration</td>
      <td>ses pools (URL, port, utilisateur) et ses tâches planifiées</td>
    </tr>
    <tr>
      <td><code>remote_push</code></td>
      <td>Accès distant modifié</td>
      <td>l'URL de push, la clé API hashboard ou un réglage de protection des données change</td>
      <td>l'URL avant et après, chaque réglage de protection des données activé ou désactivé ; la clé API n'est jamais écrite, seulement « modifiée »</td>
    </tr>
    <tr>
      <td><code>mail_settings</code></td>
      <td>Notifications modifiées</td>
      <td>le serveur SMTP ou les destinataires des mails changent</td>
      <td>chaque champ du serveur avant et après, les destinataires ajoutés ou retirés ; le mot de passe n'est jamais écrit, seulement « modifié »</td>
    </tr>
  </tbody>
</table>

Le reste d'un enregistrement (alias, nom d'hôte, modèle, tarif, appareils,
dashboards de pool, dépôts firmware) est détaillé sous <code>save_miners</code> /
<code>save_settings</code> : chaque fait n'est écrit qu'une fois, sous un
seul type. Un enregistrement qui ne change rien n'est pas tracé.

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
    <tr><td><code>service</code></td><td><code>system</code> — la partie de l'application qui a agi : <code>scheduler</code> (planificateur), <code>backup</code> (sauvegarde de chaque nuit) ou <code>mailer</code> (notifications)</td></tr>
    <tr><td><code>cron</code></td><td><code>system</code> — l'expression cron qui a déclenché l'opération</td></tr>
    <tr><td><code>error</code></td><td>Le message d'erreur, en cas d'échec</td></tr>
    <tr><td><code>changes</code></td><td>Ce qui a changé — chaque champ avec sa nature (<code>kind</code>) : <code>changed</code> (valeur avant <code>before</code> → après <code>after</code>), ou un élément de liste <code>added</code> (<code>after</code>) ou <code>removed</code> (<code>before</code>)</td></tr>
  </tbody>
</table>

---

## 🗄️ Stockage et API
{: #stockage }

Les entrées sont ajoutées dans un fichier par jour (UTC) :
`{dataDir}/data/audit/AAAA-MM-JJ.jsonl` (`./storage/data/audit/` avec
Docker), une entrée JSON par ligne.

Trois routes de l'API les exposent :

- `GET /api/audit` — les entrées entre `from` et `to` (dates RFC 3339,
  les dernières 24 heures par défaut, un an au maximum), filtrables par
  `ip` (mineur) et `type`, paginées avec `page` et `pageSize`.
- `GET /api/audit/types` — la liste de tous les types, dans l'ordre où le
  dashboard les propose : la valeur attendue par `type`.
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

La réponse de `GET /api/audit/types` — chaque type est expliqué dans
[Événements enregistrés](#evenements) :

```json
{
  "types": [
    "restart",
    "switch_primary",
    "switch_fallback",
    "save_miners",
    "save_settings",
    "export_audit",
    "download_backups",
    "discover",
    "backup",
    "audit_report",
    "miner_pool",
    "miner_schedule",
    "miner_identity",
    "miner_disabled",
    "miner_enabled",
    "miner_added",
    "remote_push",
    "mail_settings"
  ]
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
