---
title: Feeder
nav_order: 9
group: Dev
subnav:
  - title: Son rôle
    anchor: role
  - title: Chaque cycle
    anchor: cycle
  - title: Fichiers écrits
    anchor: fichiers
  - title: Envoi vers hashboard
    anchor: hashboard
  - title: Firmware
    anchor: firmware-update-detection
  - title: Sauvegardes
    anchor: sauvegardes
  - title: Logs et arrêt
    anchor: logs
---

# Feeder

<div class="toc-grid">
  <a href="#role" class="toc-card">
    <span class="toc-card-icon">🎯</span>
    <span class="toc-card-title">Son rôle</span>
  </a>
  <a href="#cycle" class="toc-card">
    <span class="toc-card-icon">🔁</span>
    <span class="toc-card-title">Chaque cycle</span>
  </a>
  <a href="#fichiers" class="toc-card">
    <span class="toc-card-icon">🗂️</span>
    <span class="toc-card-title">Fichiers écrits</span>
  </a>
  <a href="#hashboard" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-title">Envoi vers hashboard</span>
  </a>
  <a href="#firmware-update-detection" class="toc-card">
    <span class="toc-card-icon">⬆️</span>
    <span class="toc-card-title">Firmware</span>
  </a>
  <a href="#sauvegardes" class="toc-card">
    <span class="toc-card-icon">📦</span>
    <span class="toc-card-title">Sauvegardes</span>
  </a>
  <a href="#logs" class="toc-card">
    <span class="toc-card-icon">📜</span>
    <span class="toc-card-title">Logs et arrêt</span>
  </a>
</div>

Le service qui interroge les mineurs à intervalle régulier et écrit leur
historique sur le disque, d'où le dashboard le lit.

## Son rôle
{: #role }

Le feeder est le seul service qui collecte les données des mineurs. Il
tourne en continu, à côté de dashboard-api et du mailer, et ne fait que
ça :

- **collecter** — chaque mineur activé est interrogé à chaque cycle ;
- **enregistrer** — chaque relevé est ajouté à l'historique du jour, le
  dernier relevé et les totaux de chaque mineur sont mis à jour ;
- **suivre les alertes** — température, ventilateur, firmware, mineur
  hors ligne, adresse MAC différente : chacune n'est enregistrée qu'au
  moment où elle commence et où elle se termine ;
- **envoyer à hashboard** — les stats des mineurs, quand l'accès distant
  est configuré ;
- **vérifier le firmware** — la dernière release de chaque modèle ;
- **sauvegarder** — l'historique de chaque journée terminée, dans
  l'archive de son mois.

dashboard-api lit ensuite ces fichiers pour l'écran d'accueil, les
alertes et les graphes. Les actions sur les mineurs (redémarrage,
changement de pool) passent par dashboard-api.

## Chaque cycle, étape par étape
{: #cycle }

Un cycle tourne au démarrage, puis toutes les `feeder.interval` (2 minutes
par défaut, dans `dashboard.yml`).

1. **Relire la configuration** — `miners.yml` et `settings.yml` sont relus
   s'ils ont changé : un mineur ajouté, un tarif ou un accès distant
   modifié depuis la page Configuration s'appliquent dès ce cycle, sans
   redémarrage.
2. **Pour chaque mineur activé**, dans l'ordre de `miners.yml` :
   1. **Vérifier sa MAC** — un mineur sans `mac` est ignoré (erreur dans
      les logs) : son historique est rangé sous sa MAC.
   2. **L'interroger** — `GET /api/system/info` à son IP, avec le délai
      `endpoints.timeout` (5 s par défaut).
   3. **S'il ne répond pas** — une ligne « hors ligne » est ajoutée à
      l'historique du jour (`latest.json` garde le dernier relevé connu),
      puis envoyée à hashboard ; au 2ᵉ relevé manqué de suite, l'alerte
      « hors ligne » commence. On passe au mineur suivant.
   4. **Si la MAC qu'il annonce n'est pas celle configurée** (un autre
      appareil à cette IP, ou une faute de frappe) — le relevé est refusé
      et l'alerte « MAC différente » commence. On passe au mineur suivant.
   5. **Suivre les alertes** — chacune est comparée à son état au relevé
      précédent : une alerte qui commence ou se termine est enregistrée,
      une alerte qui dure ne l'est pas de nouveau. Température : commence
      au-dessus de 62 °C, se termine sous 60 °C ; ventilateur : au-dessus
      de 75 %, sous 70 % ; firmware : différent de la dernière release
      connue pour son modèle.
   6. **Enregistrer** — la ligne du relevé (mesures, tarif du kWh en
      vigueur) est ajoutée à l'historique du jour, `latest.json`
      est remplacé, et `totals.json` cumule le temps de fonctionnement, les
      parts acceptées et rejetées et le coût d'électricité depuis le
      relevé précédent.
   7. **Envoyer à hashboard** — le relevé et les totaux, si l'accès
      distant est configuré.
3. **Vérifier le firmware** — une fois par modèle présent dans la
   configuration, la dernière release est récupérée si celle en cache a
   plus de `firmware.cacheTTL`.

Un mineur désactivé n'est pas interrogé : son historique reste sur le
disque, sans nouvelles lignes.

Les alertes en cours de chaque mineur sont gardées d'un cycle à l'autre
(et d'un redémarrage du feeder à l'autre) : une alerte qui dure n'est
jamais enregistrée deux fois.

[Aller à Alertes →]({{ '/alerts.html' | relative_url }}){: .btn .btn-primary }

## Fichiers écrits
{: #fichiers }

Tout est rangé sous le `storage.dataDir` de `dashboard.yml` :

```
{dataDir}/data/bitaxes/
  aabbccddeeff/              ← un dossier par mineur, nommé par sa MAC
    2026-10-18.jsonl         ← l'historique du jour (UTC), une ligne par cycle
    latest.json              ← le dernier relevé réussi, remplacé à chaque cycle
    totals.json              ← les totaux depuis le début du suivi
    alerts.json              ← ses alertes en cours
  firmware_cache.json        ← la dernière release connue de chaque modèle
{dataDir}/data/backups/      ← les archives mensuelles, voir Sauvegardes
{dataDir}/data/audit/        ← l'audit, où le feeder trace ses sauvegardes
{dataDir}/data/alerts/       ← les alertes, un fichier par jour (UTC)
```

- **Historique du jour** (`YYYY-MM-DD.jsonl`) — un fichier par jour UTC,
  jamais réécrit, seulement complété. Chaque ligne porte l'heure (UTC), la
  réponse brute du mineur et le tarif du kWh en vigueur. Une ligne « hors
  ligne » n'a que l'heure et son alerte.
- **Dernier relevé** (`latest.json`) — la dernière ligne réussie ; c'est
  ce que l'écran d'accueil affiche pour chaque mineur.
- **Alertes** (`data/alerts/YYYY-MM-DD.jsonl`) — une ligne par alerte qui
  commence ou se termine, tous mineurs confondus ; c'est ce qu'affichent
  la page Alertes et la cloche.
- **Totaux** (`totals.json`) — temps de fonctionnement, parts acceptées et
  rejetées, coût d'électricité. Ils continuent de grandir quand le mineur
  redémarre (ses propres compteurs repartent alors de zéro) et quand le
  tarif change (chaque relevé compte au tarif de son heure).

Le nom du dossier de chaque mineur vient de sa MAC, pas de son IP : un
mineur qui change d'IP garde son historique.

[Aller à Reconstruire les totaux →]({{ '/rebuild-totals.html' | relative_url }}){: .btn .btn-primary }

## Envoi vers hashboard
{: #hashboard }

Quand l'URL de push et la clé API sont renseignées (Configuration ›
Distant), le feeder envoie à hashboard, à chaque cycle et pour chaque
mineur :

- **le relevé** — vers `…/api/push` : les mesures, le nom (ou l'alias), le
  modèle, le tarif du kWh, la dernière release du firmware et l'intervalle
  du feeder — le wallet, les pools et l'IP remplacés par `xxxxxxxx`, sauf
  si vous choisissez de les partager ([Protection des données]({{ '/hashboard.html#protection-des-donnees' | relative_url }})) ;
- **les totaux** — vers `…/api/push/totals` ;
- **une ligne « hors ligne »** — vers `…/api/push/history`, quand le
  mineur ne répond pas : le graphe 24 h du board chute à 0 comme en local.

Seul l'envoi est filtré : le relevé stocké en local reste complet. Chaque
mineur est rangé côté hashboard sous le même nom de dossier qu'en local. Les envois partent en arrière-plan, avec un délai de 10 s : un
hashboard lent ou injoignable ne retarde jamais le cycle, l'échec est
écrit dans les logs.

[Aller à Hashboard →]({{ '/hashboard.html' | relative_url }}){: .btn .btn-primary }

## Détection des mises à jour firmware
{: #firmware-update-detection }

Le feeder interroge GitHub pour la dernière release disponible, une fois
par `firmware.cacheTTL` (24h par défaut) et par modèle de mineur présent
dans la configuration. Le résultat est mis en cache dans
`{dataDir}/data/bitaxes/firmware_cache.json`.

Chaque mineur de la réponse API inclut :

```json
{
  "version": "v2.4.0",
  "latestVersion": "v2.5.1",
  "updateAvailable": true
}
```

`updateAvailable` vaut `false` au tout premier démarrage (avant que le
feeder n'ait terminé un premier cycle) ou quand le firmware est déjà à
jour — c'est ce qui affiche la nouvelle version disponible dans la
liste des mineurs et dans le détail d'un mineur.

[Aller à La liste des mineurs →]({{ '/dashboard.html#liste' | relative_url }}){: .btn .btn-primary }

## Sauvegardes mensuelles
{: #sauvegardes }

Toutes les heures, le feeder ajoute chaque journée terminée (UTC) qui
n'est pas encore archivée à l'archive de son mois,
`{dataDir}/data/backups/YYYY-MM.zip` — en pratique, la veille, juste
après minuit UTC. Les journées déjà archivées sont recopiées telles
quelles sans être recompressées, et l'archive n'est remplacée qu'une fois
entièrement écrite. Une fois un mois terminé, le MD5 de son archive est
enregistré dans `checksums.md5` : l'archive est alors définitive et n'est
plus jamais rouverte. Le tout tourne à côté du polling, sans jamais le
retarder.

Chaque sauvegarde qui ajoute une journée ou termine un mois, ou qui
échoue, apparaît dans l'audit (type `backup`).

[Aller à Sauvegardes →]({{ '/backups.html' | relative_url }}){: .btn .btn-primary }

## Logs et arrêt
{: #logs }

- **Logs** — dans `{dataDir}/logs/feeder.log` (une ligne JSON par
  événement), ou dans la console quand `global.env` vaut `dev`. Chaque
  cycle, chaque erreur d'un mineur, chaque envoi raté et chaque sauvegarde
  y sont écrits.
- **Arrêt** — le feeder s'arrête proprement sur `SIGINT` / `SIGTERM`.
- **Au démarrage** — un mineur activé sans `mac` est signalé dans les
  logs.
