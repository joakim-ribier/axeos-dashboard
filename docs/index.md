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

{% include page_nav.html position="top" %}

[Dernière version : 0.1.0 — les nouveautés]({{ '/release-v0.1.0.html' | relative_url }}){: .link-page }
{: .release-line }

Toutes les statistiques de tes mineurs Bitcoin ASIC
[AxeOS](https://github.com/skot/ESP-Miner){:target="_blank" rel="noopener noreferrer"} (Bitaxe, NerdQAxe…) au même
endroit — hashrate, température, ventilation, pools et bien plus — sans
ouvrir l'interface de chaque appareil un par un.

Tout tourne chez toi, sur un Raspberry Pi ou n'importe quelle machine de
ton réseau local : l'historique de tes mineurs, ta configuration et tes
réglages restent sur ta machine. Aucun compte à créer, il s'utilise depuis
ton réseau local.
{: .lead-privacy }

Pour suivre tes mineurs hors de chez toi, tu peux activer l'envoi vers
[hashboard.live](https://hashboard.live){:target="_blank" rel="noopener noreferrer"} : seules leurs statistiques
partent (hashrate, températures, parts…), ton wallet, tes pools et les
adresses de ton réseau restent masqués, sauf si tu choisis de les
partager. [En savoir plus]({{ '/hashboard.html' | relative_url }}){: .link-page }

[Commencer avec l'installation]({{ '/installation.html' | relative_url }}){: .btn .btn-quiet }

![Aperçu du dashboard]({{ '/assets/images/dashboard-screenshot.png' | relative_url }})
{: .shot-hero }

---

## Fonctionnalités clés

### [Accueil]({{ '/dashboard.html' | relative_url }}){: .link-heading }

- La flotte d'un coup d'œil : hashrate des dernières 24 h, puissance,
  efficacité, coût électrique par jour et depuis le début, parts, meilleure
  difficulté, température
- L'état de chaque mineur et la part de chaque pool, qui servent aussi de
  filtres rapides
- Tes mineurs en liste ou en tuiles, avec recherche, filtres et tri — les
  mineurs à problème en tête
- Le détail d'un mineur en un clic : graphique 24 h, pools, session et
  totaux depuis le début, redémarrage et bascule de pool
- Les nouvelles versions du firmware de chaque mineur et du dashboard
- L'état de chaque service de la plateforme, en bas du menu

### [Configuration]({{ '/configuration.html' | relative_url }}){: .link-heading }

- Détection des mineurs sur le réseau, ou ajout par IP
- Pour chaque mineur : nom affiché, pools principal et de secours, seuils
  d'alerte, planificateur (bascule de pool ou redémarrage à heure fixe)
- Vérification des pools de chaque mineur, et bascule de toute la flotte
  sur un pool en une fois
- Tarif électrique et autres appareils (ventilateur, routeur…) pour le
  coût journalier de toute l'installation
- Mails : serveur SMTP, destinataires, rapport d'audit (chaque jour, tous
  les 2 jours, chaque semaine ou chaque mois), mail à chaque nouvelle
  alerte, textes modifiables
- Seuils d'alerte communs à tous les mineurs, dashboards des pools

### [Alertes]({{ '/alerts.html' | relative_url }}){: .link-heading }

- Les alertes en cours sur tes mineurs : hors ligne, erreur de
  configuration, température, ventilateur, nouveau firmware
- L'historique de chaque jour, filtrable par mineur et par type
- Chaque alerte est levée une fois, et se termine quand la valeur repasse
  sous son seuil moins une marge
- Un mail à chaque nouvelle alerte, si tu l'actives

### [Sauvegardes]({{ '/backups.html' | relative_url }}){: .link-heading }

- L'historique de tes mineurs archivé automatiquement : un zip par mois,
  complété chaque nuit
- Le checksum de chaque mois terminé
- Téléchargement d'un mois ou de plusieurs à la fois

### [Audit]({{ '/audit.html' | relative_url }}){: .link-heading }

- Tout ce qui agit sur un mineur ou sur la configuration : redémarrages,
  bascules de pool, réglages enregistrés, détections réseau,
  téléchargements, actions à distance
- Depuis le dashboard (avec l'IP et le navigateur), ou par l'application
  elle-même (planificateur, sauvegarde, mails)
- Filtres par mineur, type et jour, export JSON, rapport par mail

---

## Architecture

<div class="arch-diagram">
<svg viewBox="0 0 960 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schéma d'architecture : sur le réseau local, un Raspberry Pi fait tourner le Feeder, le Mailer, la Dashboard API et l'UI autour d'un stockage local, relève les mineurs et leur transmet les actions ; sur Internet, un VPS fait tourner hashboard et le board, qui reçoivent les statistiques du feeder, et le serveur SMTP reçoit les mails">
  <defs>
    <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#5a6472"></path>
    </marker>
    <marker id="arch-arrow-action" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#ffa726"></path>
    </marker>
  </defs>

  <!-- Internet -->
  <rect x="20" y="20" width="920" height="186" rx="16" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="5 5"></rect>
  <text x="42" y="46" fill="#8892a4" font-size="12" font-weight="700" letter-spacing="1">INTERNET</text>

  <rect x="40" y="92" width="160" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="120" y="119" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Serveur SMTP</text>
  <text x="120" y="139" text-anchor="middle" fill="#8892a4" font-size="12">tes mails</text>

  <rect x="230" y="60" width="460" height="112" rx="14" fill="#1e1e2a" stroke="rgba(139,124,246,0.55)" stroke-width="1.5"></rect>
  <text x="250" y="82" fill="#8892a4" font-size="12" font-weight="700">VPS — hashboard.live</text>

  <rect x="250" y="92" width="200" height="64" rx="10" fill="#262637" stroke="#8b7cf6" stroke-width="1.5"></rect>
  <text x="350" y="119" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">hashboard</text>
  <text x="350" y="139" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go</text>

  <rect x="470" y="92" width="200" height="64" rx="10" fill="#262637" stroke="#8b7cf6" stroke-width="1.5"></rect>
  <text x="570" y="119" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Board</text>
  <text x="570" y="139" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go · React</text>

  <rect x="740" y="92" width="180" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="830" y="119" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Navigateur</text>
  <text x="830" y="139" text-anchor="middle" fill="#8892a4" font-size="12">n'importe où</text>

  <!-- Local network -->
  <rect x="20" y="226" width="920" height="474" rx="16" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="5 5"></rect>
  <text x="918" y="252" text-anchor="end" fill="#8892a4" font-size="12" font-weight="700" letter-spacing="1">RÉSEAU LOCAL</text>

  <rect x="40" y="266" width="580" height="310" rx="14" fill="#1e1e2a" stroke="rgba(0,180,255,0.45)" stroke-width="1.5"></rect>
  <text x="600" y="292" text-anchor="end" fill="#8892a4" font-size="12" font-weight="700">Raspberry Pi (ou autre machine)</text>

  <rect x="60" y="306" width="250" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="185" y="333" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Mailer</text>
  <text x="185" y="353" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go</text>

  <rect x="330" y="306" width="270" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="465" y="333" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Feeder</text>
  <text x="465" y="353" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go</text>

  <rect x="60" y="398" width="540" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="330" y="425" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Stockage local (disque)</text>
  <text x="330" y="445" text-anchor="middle" fill="#8892a4" font-size="12">historique · alertes · audit · archives</text>

  <rect x="60" y="490" width="250" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="185" y="517" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">UI</text>
  <text x="185" y="537" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">React · nginx</text>

  <rect x="330" y="490" width="270" height="64" rx="10" fill="#262637" stroke="#00b4ff" stroke-width="1.5"></rect>
  <text x="465" y="517" text-anchor="middle" fill="#e0e0e0" font-size="15" font-weight="700">Dashboard API</text>
  <text x="465" y="537" text-anchor="middle" fill="#8892a4" font-size="12" font-family="monospace">Go · chi</text>

  <rect x="60" y="616" width="250" height="56" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="185" y="640" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Navigateur</text>
  <text x="185" y="658" text-anchor="middle" fill="#8892a4" font-size="12">réseau local</text>

  <rect x="740" y="286" width="180" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="830" y="313" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Bitaxe</text>
  <text x="830" y="333" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <rect x="740" y="386" width="180" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="830" y="413" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">Bitaxe</text>
  <text x="830" y="433" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <rect x="740" y="486" width="180" height="64" rx="10" fill="#262637" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"></rect>
  <text x="830" y="513" text-anchor="middle" fill="#e0e0e0" font-size="14" font-weight="700">NerdQAxe</text>
  <text x="830" y="533" text-anchor="middle" fill="#8892a4" font-size="12">AxeOS</text>

  <!-- Data: grey -->
  <path d="M600,338 L740,318" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M600,338 L740,418" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M600,338 L740,512" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="634" y="300" fill="#8892a4" font-size="11">relevé</text>
  <text x="634" y="314" fill="#8892a4" font-size="11">toutes les 2 min</text>

  <path d="M465,370 L465,398" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="475" y="389" fill="#8892a4" font-size="11">écriture</text>
  <path d="M185,398 L185,370" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="195" y="389" fill="#8892a4" font-size="11">lecture</text>
  <path d="M465,462 L465,490" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="475" y="481" fill="#8892a4" font-size="11">lecture</text>

  <path d="M330,338 L310,338" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M310,522 L330,522" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <path d="M185,616 L185,554" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="195" y="590" fill="#8892a4" font-size="11">HTTP</text>

  <path d="M360,306 L350,156" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="366" y="244" fill="#8892a4" font-size="11">statistiques</text>
  <path d="M120,306 L120,156" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="128" y="244" fill="#8892a4" font-size="11">mails</text>
  <path d="M450,124 L470,124" fill="none" stroke="#5a6472" stroke-width="1.5" marker-start="url(#arch-arrow)"></path>
  <path d="M740,124 L670,124" fill="none" stroke="#5a6472" stroke-width="1.5" marker-end="url(#arch-arrow)"></path>
  <text x="698" y="116" fill="#8892a4" font-size="11">HTTPS</text>

  <!-- Actions: orange -->
  <path d="M600,528 L740,528" fill="none" stroke="#ffa726" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arch-arrow-action)"></path>
  <text x="634" y="548" fill="#ffa726" font-size="11">redémarrage,</text>
  <text x="634" y="562" fill="#ffa726" font-size="11">bascule de pool</text>
  <path d="M600,506 H612 V186 H430 V156" fill="none" stroke="#ffa726" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arch-arrow-action)"></path>
  <text x="602" y="200" text-anchor="end" fill="#ffa726" font-size="11">actions du board · chaque minute</text>

  <!-- Legend -->
  <path d="M640,620 L680,620" fill="none" stroke="#5a6472" stroke-width="1.5"></path>
  <text x="690" y="624" fill="#8892a4" font-size="11">données</text>
  <path d="M640,644 L680,644" fill="none" stroke="#ffa726" stroke-width="1.5" stroke-dasharray="4 3"></path>
  <text x="690" y="648" fill="#8892a4" font-size="11">actions sur les mineurs</text>
</svg>
</div>

### [Dashboard]({{ '/dashboard.html' | relative_url }}){: .link-heading }

L'interface web que tu ouvres dans ton navigateur.

### [API]({{ '/api.html' | relative_url }}){: .link-heading }

Lit l'historique enregistré par le feeder pour l'interface, et transmet
tes actions aux mineurs.

### [Feeder]({{ '/feeder.html' | relative_url }}){: .link-heading }

Relève tes mineurs toutes les 2 minutes et enregistre leur historique sur
le disque.

### [Mailer]({{ '/mailer.html' | relative_url }}){: .link-heading }

Envoie tous les mails par ton serveur SMTP.

### [Hashboard]({{ '/hashboard.html' | relative_url }}){: .link-heading }

Sur un VPS : affiche les statistiques de tes mineurs sur ton board, de
n'importe où.

---

## Modèles supportés
{: #modeles-supportes }

Firmware testé, jusqu'à ces versions :

- Bitaxe Gamma — [v2.15.4](https://github.com/bitaxeorg/esp-miner/releases/tag/v2.15.4){:target="_blank" rel="noopener noreferrer"}
- NerdQAxe++ — [v1.1.2](https://github.com/shufps/ESP-Miner-NerdQAxePlus/releases/tag/v1.1.2){:target="_blank" rel="noopener noreferrer"}

{% include page_nav.html position="bottom" %}
