---
title: Configuration
nav_order: 3
group: Pages
subnav:
  - title: Détection automatique
    anchor: detection-automatique
  - title: Mineurs configurés
    anchor: mineurs-configures
  - title: Électricité & pools
    anchor: electricite-pools
  - title: Remote (hashboard.live)
    anchor: remote-hashboardlive
---

# Configuration

<div class="toc-grid">
  <a href="#detection-automatique" class="toc-card">
    <span class="toc-card-icon">🔍</span>
    <span class="toc-card-title">Détection automatique</span>
  </a>
  <a href="#mineurs-configures" class="toc-card">
    <span class="toc-card-icon">🖥️</span>
    <span class="toc-card-title">Mineurs configurés</span>
  </a>
  <a href="#electricite-pools" class="toc-card">
    <span class="toc-card-icon">⚡</span>
    <span class="toc-card-title">Électricité & pools</span>
  </a>
  <a href="#remote-hashboardlive" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-title">Remote (hashboard.live)</span>
  </a>
</div>

## 🔍 Détection automatique
{: #detection-automatique }

Scanne le réseau local à la recherche de mineurs AxeOS (bitaxe,
nerdaxe). Un mineur non trouvé (autre sous-réseau, pare-feu...) peut être
ajouté directement par IP, juste à côté.

![Détection automatique]({{ '/assets/images/settings-scan-before.png' | relative_url }})

Les mineurs trouvés s'affichent en dessous, prêts à être ajoutés à la
configuration.

![Résultats de la détection]({{ '/assets/images/settings-scan-results.png' | relative_url }})

---

## 🖥️ Mineurs configurés
{: #mineurs-configures }

La liste des mineurs déjà configurés, avec leur IP, MAC, modèle et état
— activation/désactivation en un clic, par mineur ou tous à la fois.

![Mineurs configurés]({{ '/assets/images/settings-configured-miners.png' | relative_url }})

### Nom et pools

Cliquer sur un mineur déplie son éditeur : nom affiché, et pool primaire
/ secours (URL, port, utilisateur).

![Nom et pools]({{ '/assets/images/settings-alias-pools.png' | relative_url }})

### Planificateur

Programme un changement de pool ou un redémarrage selon un planning cron.

![Planificateur]({{ '/assets/images/settings-schedule.png' | relative_url }})

---

## ⚡ Électricité & pools
{: #electricite-pools }

### Électricité

Le tarif électrique (€/kWh) sert à estimer le coût journalier affiché
sur l'accueil.

![Électricité]({{ '/assets/images/settings-electricity.png' | relative_url }})

### Dashboards des pools

Certains pools ont déjà un lien cliquable intégré (Braiins, Atlas...).
Pour un pool non reconnu nativement par l'app, on peut ajouter
soi-même la correspondance entre son hostname et l'URL de son
dashboard, avec `{user}` comme placeholder pour la partie compte de
l'utilisateur stratum — le lien devient alors cliquable sur les cartes
mineurs qui utilisent ce pool.

![Dashboards des pools]({{ '/assets/images/settings-pools.png' | relative_url }})

---

## ☁️ Remote (hashboard.live)
{: #remote-hashboardlive }

Envoie vos données vers [hashboard.live](https://hashboard.live) pour
consulter vos mineurs depuis n'importe où, sans VPN — il suffit de coller
l'URL de push et votre clé API.

![Remote (hashboard)]({{ '/assets/images/settings-remote.png' | relative_url }})
