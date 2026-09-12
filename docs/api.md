---
title: API
nav_order: 9
group: Dev
---

# API

Référence navigable des endpoints REST de dashboard-api et
remote-dashboard-api, générée directement depuis les annotations des
handlers Go — toujours synchronisée avec ce qui est réellement déployé.

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

<a href="{{ '/assets/api/index.html' | relative_url }}" target="_blank" class="btn btn-primary">Ouvrir en plein écran →</a>

<iframe src="{{ '/assets/api/index.html' | relative_url }}" style="width: 100%; height: 85vh; border: 1px solid var(--border-color, #454545); border-radius: 6px; margin-top: 1rem;"></iframe>

Spec brute, pour l'importer dans un autre outil :
[`swagger.yaml`](https://github.com/joakim-ribier/axeos-dashboard/blob/main/server/docs/swagger/swagger.yaml) /
[`swagger.json`]({{ '/assets/api/swagger.json' | relative_url }}).
