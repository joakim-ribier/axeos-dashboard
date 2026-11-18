---
title: API
nav_order: 10
group: Dev
---

{% include page_nav.html position="top" %}

Référence navigable des endpoints REST de dashboard-api,
remote-dashboard-api et du mailer, générée directement depuis les
annotations des handlers Go — toujours synchronisée avec ce qui est
réellement déployé. Les endpoints sont rangés par service, puis par
domaine (mineurs, alertes, audit, configuration...).

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ make swagger</span>
<span class="term-comment">&gt;&gt;&gt; Regenerating OpenAPI spec...</span>
cd server && go tool swag init -g cmd/dashboard-api/main.go -o docs/swagger --outputTypes json,yaml --parseInternal
...
create swagger.json at docs/swagger/swagger.json
create swagger.yaml at docs/swagger/swagger.yaml
cp server/docs/swagger/swagger.json docs/assets/api/swagger.json
<span class="term-comment">&gt;&gt;&gt; Done. See server/docs/swagger/swagger.yaml and docs/assets/api/swagger.json</span></pre>
</div>

[Ouvrir en plein écran]({{ '/assets/api/index.html' | relative_url }}){:target="_blank" rel="noopener noreferrer"}

<iframe src="{{ '/assets/api/index.html' | relative_url }}" style="width: 100%; height: 85vh; border: 1px solid var(--border-color, #454545); border-radius: 6px; margin-top: 1rem;"></iframe>

Spec brute, pour l'importer dans un autre outil :
[`swagger.yaml`](https://github.com/joakim-ribier/axeos-dashboard/blob/main/server/docs/swagger/swagger.yaml){:target="_blank" rel="noopener noreferrer"} /
[`swagger.json`]({{ '/assets/api/swagger.json' | relative_url }}){:target="_blank" rel="noopener noreferrer"}.

---

## 🔎 Une entrée de l'audit
{: #audit-entree }

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
    <tr><td><code>type</code></td><td>Le type d'événement — voir la page Audit</td></tr>
    <tr><td><code>target</code></td><td>L'IP du mineur concerné — absent pour un enregistrement de configuration ou une bascule sur tous les mineurs</td></tr>
    <tr><td><code>ip</code></td><td><code>api</code> — l'adresse IP de l'appareil qui a fait la demande</td></tr>
    <tr><td><code>userAgent</code></td><td><code>api</code> — le navigateur de cet appareil</td></tr>
    <tr><td><code>requestId</code></td><td><code>api</code> — l'identifiant de la requête, le même que dans les logs du dashboard</td></tr>
    <tr><td><code>status</code></td><td><code>api</code> — le code HTTP de la réponse (400 ou plus : échec)</td></tr>
    <tr><td><code>query</code></td><td><code>api</code> — les paramètres de la demande : les mois téléchargés, la période et les filtres exportés, le mineur ciblé…</td></tr>
    <tr><td><code>service</code></td><td><code>system</code> — qui a agi : <code>scheduler</code> (planificateur), <code>backup</code> (sauvegarde de chaque nuit), <code>mailer</code> (notifications) ou <code>remote</code> (une action demandée depuis ton board, avec son IP et son navigateur)</td></tr>
    <tr><td><code>cron</code></td><td><code>system</code> — l'expression cron qui a déclenché l'opération</td></tr>
    <tr><td><code>error</code></td><td>Le message d'erreur, en cas d'échec</td></tr>
    <tr><td><code>changes</code></td><td>Ce qui a changé — chaque champ avec sa nature (<code>kind</code>) : <code>changed</code> (valeur avant <code>before</code> → après <code>after</code>), ou un élément de liste <code>added</code> (<code>after</code>) ou <code>removed</code> (<code>before</code>)</td></tr>
  </tbody>
</table>

---

## 🗄️ L'audit : stockage et routes
{: #audit-stockage }

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
  fichier JSON du bouton *Exporter*, la période et les filtres avant la
  liste des entrées.

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

La réponse de `GET /api/audit/types` :

```json
{
  "types": [
    "restart",
    "switch_primary",
    "switch_fallback",
    "switch_pool",
    "save_miners",
    "save_settings",
    "export_audit",
    "download_backups",
    "discover",
    "backup",
    "audit_report",
    "alert_mail",
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

Chaque type est expliqué sur la page Audit.
[Audit › Événements enregistrés]({{ '/audit.html#evenements' | relative_url }}){: .link-page }

{% include page_nav.html position="bottom" %}
