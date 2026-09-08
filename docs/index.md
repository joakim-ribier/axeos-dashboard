---
title: Accueil
layout: home
nav_order: 1
subnav:
  - title: Architecture
    anchor: architecture
  - title: Modèles supportés
    anchor: modeles-supportes
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

---

## Fonctionnalités clés

### Accueil

- Vue d'ensemble de tous les mineurs : hashrate, température,
  ventilation, shares, uptime...
- Calcul des totaux de vie (uptime + shares acceptés)
- Vue des pools primaire et secours, accessible en un clic
- Switch de pool et redémarrage à la demande
- Détection des nouvelles versions de firmware
- Détection d'une nouvelle version du dashboard

[Voir le détail de l'écran d'accueil]({{ '/dashboard.html' | relative_url }}){: .btn .btn-primary }

### Settings

- Détection automatique des mineurs sur le réseau
- Configuration des pools
- Programmation d'un scheduler (cron) pour switcher ou redémarrer
  automatiquement
- Réglage du tarif électrique

[Voir le détail de Configuration]({{ '/configuration.html' | relative_url }}){: .btn .btn-primary }

### Alertes

- Page dédiée aux alertes (température, ventilation, hors-ligne,
  configuration, firmware...)

---

## Architecture

<div class="arch-diagram">
<svg viewBox="0 0 860 610" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schéma d'architecture : Feeder et Dashboard API (Go) et UI (React) tournant sur un Raspberry Pi, communiquant avec les mineurs et un stockage local, accessible depuis un navigateur">
  <defs>
    <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#5a6472"></path>
    </marker>
  </defs>

  <rect x="20" y="20" width="820" height="490" rx="16" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="5 5"></rect>
  <text x="42" y="46" fill="#8892a4" font-size="12" font-weight="700" letter-spacing="1">RÉSEAU LOCAL</text>

  <rect x="48" y="70" width="440" height="400" rx="14" fill="#1e1e2a" stroke="rgba(0,180,255,0.45)" stroke-width="1.5"></rect>
  <text x="70" y="98" fill="#8892a4" font-size="12" font-weight="700">Raspberry Pi (ou autre machine)</text>

  <!-- Feeder -->
  <rect x="68" y="112" width="400" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="268" y="138" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Feeder</text>
  <text x="268" y="158" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go</text>

  <!-- Storage -->
  <rect x="68" y="204" width="400" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="268" y="228" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700" font-family="monospace">latest.json + jour.jsonl</text>
  <text x="268" y="248" text-anchor="middle" fill="#8892a4" font-size="12">Stockage local (disque)</text>

  <!-- Dashboard API -->
  <rect x="68" y="296" width="400" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="268" y="322" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Dashboard API</text>
  <text x="268" y="342" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go · chi</text>

  <!-- UI -->
  <rect x="68" y="388" width="400" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="268" y="414" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">UI</text>
  <text x="268" y="434" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">React · nginx</text>

  <!-- Miners -->
  <rect x="545" y="90" width="255" height="72" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="672" y="119" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Bitaxe</text>
  <text x="672" y="139" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <rect x="545" y="240" width="255" height="72" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="672" y="269" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Bitaxe</text>
  <text x="672" y="289" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <rect x="545" y="390" width="255" height="72" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="672" y="419" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">NerdQAxe</text>
  <text x="672" y="439" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <!-- Browser -->
  <rect x="48" y="540" width="210" height="56" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="153" y="574" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Navigateur</text>

  <!-- Feeder -> miners (polling) -->
  <path d="M468,144 L545,126" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M468,144 L545,276" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M468,144 L545,426" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="486" y="188" fill="#8892a4" font-size="11" font-family="monospace">GET /api/system/info</text>
  <text x="486" y="202" fill="#8892a4" font-size="11">toutes les 2 min</text>

  <!-- Dashboard API -> miners (control actions) -->
  <path d="M468,320 L545,276" fill="none" stroke="#ffa726" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arch-arrow)"></path>
  <text x="486" y="240" fill="#ffa726" font-size="11" font-family="monospace">POST switch / restart</text>
  <text x="486" y="254" fill="#8892a4" font-size="11">contrôle, à la demande</text>

  <!-- Feeder -> Storage (écriture) -->
  <path d="M268,176 L268,204" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="300" y="194" fill="#8892a4" font-size="11">écriture</text>

  <!-- Dashboard API -> Storage (lecture) -->
  <path d="M268,296 L268,268" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="300" y="286" fill="#8892a4" font-size="11">lecture</text>

  <!-- UI -> Dashboard API -->
  <path d="M320,388 L320,360" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="336" y="378" fill="#8892a4" font-size="11">/api/*</text>

  <!-- Browser -> UI -->
  <path d="M178,540 L245,452" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="185" y="500" fill="#8892a4" font-size="11">HTTP</text>
</svg>
</div>

### Feeder

Un service qui tourne en continu sur la configuration des mineurs
enregistrés. Il interroge chaque mineur toutes les 2 minutes (intervalle
configurable côté serveur), et enregistre le résultat à deux endroits :
`latest.json`, le dernier état du mineur, et un fichier `.jsonl`,
l'historique de chaque itération, stocké par jour.

### Dashboard (API + UI)

Le dashboard comprend une API et une interface web. Il ne parle pas
directement aux mineurs — son rôle est principalement de restituer les
informations déjà stockées par le feeder (`latest.json` et l'historique
du jour), et de proxyfier les quelques actions de contrôle (switch de
pool, redémarrage) vers les mineurs.

---

## Modèles supportés
{: #modeles-supportes }

Firmware testé, jusqu'à ces versions :

- **Bitaxe Gamma** — [v2.15.1](https://github.com/bitaxeorg/esp-miner/releases/tag/v2.15.1){:target="_blank" rel="noopener noreferrer"}
- **NerdQAxe++** — [v1.0.37.3-LTS](https://github.com/shufps/ESP-Miner-NerdQAxePlus/releases/tag/v1.0.37.3-LTS){:target="_blank" rel="noopener noreferrer"}
