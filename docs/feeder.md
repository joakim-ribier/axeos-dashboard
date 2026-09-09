---
title: Feeder
nav_order: 8
group: Dev
subnav:
  - title: Firmware
    anchor: firmware-update-detection
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
jour — c'est ce qui déclenche le badge orange de mise à jour sur la card
d'un mineur.

[Aller à La card →]({{ '/dashboard.html#la-card' | relative_url }}){: .btn .btn-primary }
