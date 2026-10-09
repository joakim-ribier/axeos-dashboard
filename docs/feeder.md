---
title: Feeder
nav_order: 9
group: Dev
subnav:
  - title: Firmware
    anchor: firmware-update-detection
  - title: Sauvegardes
    anchor: sauvegardes
---

# Feeder

## Détection des mises à jour firmware
{: #firmware-update-detection }

Le feeder interroge GitHub pour la dernière release disponible, une fois
par `firmware.cacheTTL` (24h par défaut) et par modèle de mineur présent
dans la configuration. Le résultat est mis en cache dans
`{dataDir}/data/firmware_cache.json`.

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

[Aller à Sauvegardes →]({{ '/backups.html' | relative_url }}){: .btn .btn-primary }
