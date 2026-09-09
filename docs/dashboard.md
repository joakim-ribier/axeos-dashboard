---
title: Écran d'accueil
nav_order: 3
group: Pages
subnav:
  - title: Sidebar
    anchor: sidebar
  - title: Top bar
    anchor: top-bar
  - title: Totaux des cards
    anchor: totaux-des-cards
  - title: Recherche, filtres & tri
    anchor: recherche-filtres-tri
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
  <a href="#recherche-filtres-tri" class="toc-card">
    <span class="toc-card-icon">🔍</span>
    <span class="toc-card-title">Recherche, filtres & tri</span>
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
   [Aller à Alertes →]({{ '/alerts.html' | relative_url }}){: .btn .btn-primary }
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
2. **Parts (session)** — total des shares acceptées depuis le démarrage
   du feeder ; en dessous, le total cumulé depuis la toute première mise
   en route, qui persiste après un redémarrage d'un mineur.
3. **Temp · Ventil.** — température : le chiffre de **gauche** est le minimum, celui de **droite** le maximum, parmi tous les mineurs. En dessous, la vitesse de ventilation **maximale** relevée.
4. **Mineurs** — nombre de mineurs configurés, consommation totale (W) et estimation annuelle (kWh/an).
5. **Coût élec. / jour** — coût électrique journalier estimé, à partir du tarif configuré.

---

## 🔍 Recherche, filtres & tri
{: #recherche-filtres-tri }

Une ligne sous les totaux permet d'affiner l'affichage des cards, sans
appel réseau supplémentaire :

![Recherche, filtres et tri]({{ '/assets/images/actionbar.png' | relative_url }})

1. **Pool** — liste déroulante des pools actuellement utilisés (n'apparaît
   que si plusieurs sont actifs), avec le nombre de mineurs et le hashrate
   cumulé par pool.
2. **Tri** — 5 ordres possibles, mémorisés entre les visites : uptime
   total croissant (par défaut), parts acceptées, ventilateur le plus
   rapide, température la plus haute, ou nom de pool (A-Z).
3. **Filtres** — ouvre/ferme le panneau ci-dessous.
4. **Recherche** — texte libre (hostname, IP, modèle, pool, utilisateur
   stratum, version firmware) ou comparaisons : `temp>60`, `fan<=50`,
   `power>15`, `hashrate<0.3`, `uptime>3600` (secondes). Mot-clé `offline`
   (négation avec `!offline`/`-offline`). Plusieurs termes séparés par un
   espace doivent tous correspondre ; négation avec `-`/`!`.
5. **Modèle** — filtre rapide par type de mineur, avec le compteur pour
   chacun.
6. **Alertes** — filtre rapide par condition (température haute,
   ventilateur haut, hors ligne), avec le compteur pour chacune.

---

## 📇 La card
{: #la-card }

![La card]({{ '/assets/images/card-collapsed.png' | relative_url }})

1. **Nom** — alias ou hostname du mineur, précédé d'un point indiquant son
   état : vert (joignable), rouge (injoignable), gris (première
   vérification en attente), orange (configuration incohérente — voir
   plus bas).
2. **Horodatage** — date et heure de la dernière donnée reçue.
3. **Modèle** — bitaxe ou nerdaxe, avec sa variante matérielle.
4. **Adresse IP** — lien direct vers l'interface du mineur.
5. **Hashrate** — débit de hachage actuel (TH/s) et meilleure difficulté de la session.
6. **Shares** — nombre de parts acceptées / rejetées.
7. **Température · Ventilation** — température des puces et vitesse du ventilateur.
8. **Consommation · Efficacité** — puissance (W) et rendement (J/TH).
9. **Pool actif** — pool utilisé, temps de réponse, badge Principal/Secours.
   Le chevron développe le détail : utilisateur stratum et pool inactif.
   Une icône ⧉ ouvre le tableau de bord du pool, quand un lien est
   configuré pour lui (voir
   [Configuration]({{ '/configuration.html#electricite-pools' | relative_url }})).
10. **Uptime · Firmware** — durée depuis le dernier redémarrage (badge
    orange < 1h, gris 1-24h, vert ≥ 24h), version installée et badge
    orange si une mise à jour est disponible.
11. **Actions** — changer de pool ou redémarrer le mineur (confirmation demandée).
12. **Historique / Totaux** — bascule entre le graphique du jour et les totaux cumulés depuis la première mise en route.

{: .note }
> ⚠️ Si la `mac:` configurée pour un mineur ne correspond pas à ce qu'il
> reporte réellement (mauvais appareil à cette IP, ou faute de frappe),
> un bandeau orange apparaît sous l'en-tête de la card avec le détail de
> l'erreur (et un bouton pour le copier), et le point de statut passe à
> l'orange.

---

## 📈 La card avec le graphique du jour
{: #la-card-avec-le-graphique-du-jour }

![La card avec le graphique du jour]({{ '/assets/images/card-day-graph.png' | relative_url }})

1. **Historique de la journée** — onglet à déplier pour afficher le graphique.
2. **Métriques** — choix de la donnée affichée : température, ventilation, hashrate ou ping.
3. **Période** — **1H** (dernière heure) ou **Jour** (moyennes horaires sur la journée complète).
4. **Graphique** — évolution de la métrique choisie sur la période sélectionnée.
