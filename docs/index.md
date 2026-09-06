---
title: Accueil
layout: home
nav_order: 1
---

# axeos-dashboard

**axeos-dashboard** est un dashboard local qui centralise en un seul
endroit les statistiques de tous vos mineurs Bitcoin ASIC compatibles
[AxeOs](https://github.com/skot/ESP-Miner) (Bitaxe, NerdQAxe...) —
hashrate, température, ventilation, pools, et bien plus — sans avoir à
ouvrir l'interface de chaque appareil un par un.

Conçu pour tourner sur un Raspberry Pi ou toute machine de votre réseau
local. Aucune authentification requise — usage réseau local uniquement.

[Commencer avec l'installation](installation){: .btn .btn-primary }

{: .note }
> **Surveillance à distance** — Exportez vos données vers le cloud pour
> surveiller vos mineurs depuis n'importe où dans le monde, sans VPN, via
> [hashboard.live](https://hashboard.live).

![Aperçu du dashboard axeos-dashboard]({{ '/assets/images/dashboard-screenshot.png' | relative_url }})

## Fonctionnalités clés

- Hashrate, température, vitesse des ventilateurs, shares et uptime en
  temps réel, pour chaque mineur
- Totaux cumulés (uptime + shares acceptés) qui survivent aux
  redémarrages des appareils, affichés à côté des valeurs de la session
  en cours
- Alertes calculées côté serveur (seuils température/ventilation,
  appareil hors-ligne, incohérence de configuration, mise à jour
  firmware disponible) — cloche de notification en direct et historique
  paginé et filtrable
- Changement de pool (principal ↔ secours), manuel ou programmé
  (planification cron)
- Détection des mises à jour firmware par rapport aux releases GitHub,
  par modèle d'appareil
- Graphique d'historique du jour — dernière heure ou journée complète,
  moyennes horaires
- Estimation du coût électrique (jour/mois) à partir de votre tarif
  €/kWh configuré
- Liens cliquables vers les dashboards des pools (Braiins, Atlas...),
  résolus automatiquement depuis l'utilisateur stratum
- Vérification de la joignabilité en direct, avec avertissement en cas
  d'incohérence entre l'appareil et son adresse MAC configurée
- Vue à distance optionnelle via hashboard.live — consultez vos mineurs
  depuis n'importe où, sans VPN
- Localisation EN / FR
