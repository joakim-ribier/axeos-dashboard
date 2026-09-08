---
title: Écran d'accueil
nav_order: 4
group: Pages
subnav:
  - title: Sidebar
    anchor: sidebar
  - title: Top bar
    anchor: top-bar
  - title: Totaux des cards
    anchor: totaux-des-cards
  - title: La card
    anchor: la-card
  - title: La card avec le graphique du jour
    anchor: la-card-avec-le-graphique-du-jour
---

# Écran d'accueil

<div class="toc-grid">
  <a href="#sidebar" class="toc-card">
    <span class="toc-card-icon">☰</span>
    <span class="toc-card-title">Sidebar</span>
  </a>
  <a href="#top-bar" class="toc-card">
    <span class="toc-card-icon">🔔</span>
    <span class="toc-card-title">Top bar</span>
  </a>
  <a href="#totaux-des-cards" class="toc-card">
    <span class="toc-card-icon">📊</span>
    <span class="toc-card-title">Totaux des cards</span>
  </a>
  <a href="#la-card" class="toc-card">
    <span class="toc-card-icon">📇</span>
    <span class="toc-card-title">La card</span>
  </a>
  <a href="#la-card-avec-le-graphique-du-jour" class="toc-card">
    <span class="toc-card-icon">📈</span>
    <span class="toc-card-title">Card + graphique</span>
  </a>
</div>

## ☰ Sidebar
{: #sidebar }

![Sidebar]({{ '/assets/images/sidebar-only.png' | relative_url }})

1. **AxeOS · D#hashboard** — nom de l'application, cliquable pour revenir à l'accueil.
2. **Accueil** — vue d'ensemble de tous les mineurs.
3. **Alertes** — historique des alertes (température, ventilation, hors-ligne...).
4. **Configuration** — détection automatique, mineurs configurés, remote.
   [Aller à Configuration →]({{ '/configuration.html' | relative_url }}){: .btn .btn-primary }
5. **Actualisation auto** — active/désactive le rafraîchissement automatique des données.
6. **Version** — SHA du build actuellement déployé.
7. **Mise à jour dispo** — n'apparaît que si une nouvelle version du dashboard est disponible sur GitHub ; clic pour ouvrir la release.

---

## 🔔 Top bar
{: #top-bar }

![Top bar]({{ '/assets/images/topbar-only.png' | relative_url }})

1. **Rafraîchir** — indique si l'actualisation auto est active.
2. **Notifications** — historique des événements (alerte résolue, mise à jour disponible...).
3. **Langue** — bascule entre français et anglais.

---

## 📊 Totaux des cards
{: #totaux-des-cards }

![Totaux des cards]({{ '/assets/images/globalstats.png' | relative_url }})

1. **Hashrate total** — somme du hashrate de tous les mineurs actifs.
2. **Parts (session)** — total des shares acceptées depuis le démarrage du feeder.
3. **Temp · Ventil.** — température : le chiffre de **gauche** est le minimum, celui de **droite** le maximum, parmi tous les mineurs. En dessous, la vitesse de ventilation **maximale** relevée.
4. **Mineurs** — nombre de mineurs configurés, consommation totale (W) et estimation annuelle (kWh/an).
5. **Coût élec. / jour** — coût électrique journalier estimé, à partir du tarif configuré.

---

## 📇 La card
{: #la-card }

![La card]({{ '/assets/images/card-collapsed.png' | relative_url }})

1. **Nom** — alias ou hostname du mineur, précédé d'un point indiquant s'il est joignable.
2. **Horodatage** — date et heure de la dernière donnée reçue.
3. **Modèle** — bitaxe ou nerdaxe, avec sa variante matérielle.
4. **Adresse IP** — lien direct vers l'interface du mineur.
5. **Hashrate** — débit de hachage actuel (TH/s) et meilleure difficulté de la session.
6. **Shares** — nombre de parts acceptées / rejetées.
7. **Température · Ventilation** — température des puces et vitesse du ventilateur.
8. **Consommation · Efficacité** — puissance (W) et rendement (J/TH).
9. **Pool actif** — pool utilisé, temps de réponse, badge Principal/Secours, et un chevron pour voir le détail.
10. **Uptime · Firmware** — durée depuis le dernier redémarrage, version installée et mise à jour disponible le cas échéant.
11. **Actions** — changer de pool ou redémarrer le mineur.
12. **Historique / Totaux** — bascule entre le graphique du jour et les totaux cumulés depuis la première mise en route.

---

## 📈 La card avec le graphique du jour
{: #la-card-avec-le-graphique-du-jour }

![La card avec le graphique du jour]({{ '/assets/images/card-day-graph.png' | relative_url }})

1. **Historique de la journée** — onglet à déplier pour afficher le graphique.
2. **Métriques** — choix de la donnée affichée : température, ventilation, hashrate ou ping.
3. **Période** — **1H** (dernière heure) ou **Jour** (moyennes horaires sur la journée complète).
4. **Graphique** — évolution de la métrique choisie sur la période sélectionnée.
