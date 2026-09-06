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

### Dashboard

- Vue d'ensemble de tous les mineurs : hashrate, température,
  ventilation, shares, uptime...
- Calcul des totaux de vie (uptime + shares acceptés)
- Vue des pools primaire et secours, accessible en un clic
- Switch de pool et redémarrage à la demande

### Settings

- Détection automatique des mineurs sur le réseau
- Configuration des pools
- Programmation d'un scheduler (cron) pour switcher ou redémarrer
  automatiquement
- Réglage du tarif électrique

### Alertes

- Page dédiée aux alertes (température, ventilation, hors-ligne,
  configuration, firmware...)
