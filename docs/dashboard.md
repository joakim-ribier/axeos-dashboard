---
title: Écran d'accueil
nav_order: 3
group: Pages
subnav:
  - title: Menu
    anchor: sidebar
  - title: Barre du haut
    anchor: top-bar
  - title: La flotte
    anchor: flotte
  - title: État des mineurs & pools
    anchor: etat-pools
  - title: Recherche, filtres & tri
    anchor: recherche-filtres-tri
  - title: La liste des mineurs
    anchor: liste
  - title: Le détail d'un mineur
    anchor: detail
---

# Écran d'accueil

<div class="toc-grid">
  <a href="#sidebar" class="toc-card">
    <span class="toc-card-icon">☰</span>
    <span class="toc-card-title">Menu</span>
  </a>
  <a href="#top-bar" class="toc-card">
    <span class="toc-card-icon">🔔</span>
    <span class="toc-card-title">Barre du haut</span>
  </a>
  <a href="#flotte" class="toc-card">
    <span class="toc-card-icon">📊</span>
    <span class="toc-card-title">La flotte</span>
  </a>
  <a href="#etat-pools" class="toc-card">
    <span class="toc-card-icon">🚦</span>
    <span class="toc-card-title">État & pools</span>
  </a>
  <a href="#recherche-filtres-tri" class="toc-card">
    <span class="toc-card-icon">🔍</span>
    <span class="toc-card-title">Recherche, filtres & tri</span>
  </a>
  <a href="#liste" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-title">La liste</span>
  </a>
  <a href="#detail" class="toc-card">
    <span class="toc-card-icon">🔎</span>
    <span class="toc-card-title">Le détail</span>
  </a>
</div>

## ☰ Menu
{: #sidebar }

<div class="shot-aside" markdown="1">

![Menu]({{ '/assets/images/sidebar-only.png' | relative_url }}){: width="240" }

1. **AxeOS · D#hashboard** — recharge l'application et revient à l'accueil,
   comme à l'arrivée sur le dashboard.
2. **Accueil** — vue d'ensemble de tous les mineurs.
3. **Alertes** — historique des alertes (température, ventilation, hors-ligne...).
   [Aller à Alertes →]({{ '/alerts.html' | relative_url }}){: .btn .btn-primary }
4. **Configuration** — détection automatique, mineurs configurés, remote.
   [Aller à Configuration →]({{ '/configuration.html' | relative_url }}){: .btn .btn-primary }
5. **Sauvegardes** — archives mensuelles de l'historique des mineurs, à télécharger.
   [Aller à Sauvegardes →]({{ '/backups.html' | relative_url }}){: .btn .btn-primary }
6. **Audit** — historique des redémarrages, bascules de pool, modifications de la configuration, exports et détections réseau.
   [Aller à Audit →]({{ '/audit.html' | relative_url }}){: .btn .btn-primary }
7. **Actualisation auto** — active/désactive le rafraîchissement automatique des données.
8. **Version** — SHA du build actuellement déployé.
9. **Mise à jour dispo** — n'apparaît que si une nouvelle version du dashboard est disponible sur GitHub ; clic pour ouvrir la release.

</div>

Sur téléphone, le menu s'ouvre avec le bouton ☰ de la barre du haut.

---

## 🔔 Barre du haut
{: #top-bar }

Toujours visible en haut de l'écran, même en faisant défiler la page.

![Barre du haut]({{ '/assets/images/topbar-only.png' | relative_url }})

1. **Page** — icône, titre et description de la page affichée.
2. **Documentation** — ouvre cette documentation.
3. **Actualisation auto** — indique si l'actualisation automatique est
   active (bleu) ou non (gris).
4. **Notifications** — alertes en cours et événements récents (alerte
   résolue, mise à jour disponible...) ; le badge rouge compte les non
   lues.
5. **Langue** — bascule entre français et anglais.

Sur téléphone, la barre garde l'essentiel :

![Barre du haut sur téléphone]({{ '/assets/images/topbar-mobile.png' | relative_url }}){: width="390" }

1. **Menu** — ouvre le menu.
2. **Page** — icône et titre de la page affichée.
3. **Actualisation auto**
4. **Notifications**
5. **Plus** — déplie la documentation et la langue sous la barre ; se
   replie à chaque changement de page.

---

## 📊 La flotte
{: #flotte }

![La flotte]({{ '/assets/images/fleet.png' | relative_url }})

1. **Hashrate de la flotte · 24 h** — la production de l'ensemble des
   mineurs.
2. **Santé** — nombre de mineurs sans problème sur le total. Prend la
   couleur du problème le plus urgent s'il y en a un. Un clic déplie la
   liste de tous les mineurs, ceux à problème en tête, chacun avec son
   état ; un clic sur un mineur ouvre [son détail](#detail).

   ![Liste des mineurs sous la santé]({{ '/assets/images/fleet-health.png' | relative_url }}){: width="328" }

3. **Dernier relevé** — heure du relevé le plus récent. Passe en rouge
   quand même ce relevé date de plus de 2 fois l'intervalle de sondage
   configuré : le feeder ne tourne plus.
4. **Hashrate actuel** — somme du hashrate des mineurs joignables, et à
   côté la moyenne sur les dernières 24 h.
5. **Graphique 24 h** — le hashrate cumulé de la flotte, par tranches de
   15 minutes. Une période sans aucun relevé (feeder arrêté) apparaît en
   gris.
6. **Puissance** — consommation totale des mineurs joignables ; en
   dessous, la plus faible ↓ et la plus forte ↑ d'un mineur.
7. **Efficacité** — rendement de la flotte (J/TH) ; en dessous, le
   meilleur ↓ et le moins bon ↑ des mineurs.
8. **Électricité** — coût estimé sur une journée à la consommation
   actuelle et au tarif configuré, pour l'installation complète : les
   mineurs plus les
   [autres appareils]({{ '/configuration.html#electricite-pools' | relative_url }})
   déclarés (ventilateur, routeur...). En dessous, le total réellement
   dépensé depuis que chaque mineur est suivi — un changement de tarif
   plus tard ne modifie jamais ce total passé.
9. **Parts** — total des parts acceptées depuis le démarrage des mineurs ;
   en dessous, le total cumulé depuis leur toute première mise en route.
10. **Meilleure diff.** — la meilleure difficulté atteinte, et le mineur
    qui la détient.
11. **Température** — la plus basse ↓ et la plus haute ↑ des puces ; en
    dessous, la vitesse de ventilateur la plus élevée.

---

## 🚦 État des mineurs & pools
{: #etat-pools }

![État des mineurs et pools]({{ '/assets/images/breakdowns.png' | relative_url }})

1. **État des mineurs** — la répartition des mineurs par état, du plus
   urgent au moins urgent :
   - **Hors ligne** — le mineur ne répond plus.
   - **Erreur de config** — la `mac:` configurée ne correspond pas à ce
     que le mineur reporte (mauvais appareil à cette IP, ou faute de
     frappe).
   - **En retard** — le mineur répond, mais aucun relevé n'est arrivé
     depuis plus de 2 fois l'intervalle de sondage.
   - **En alerte** — température de puce à 62 °C ou plus, ou ventilateur
     à 75 % ou plus.
   - **En ligne** — tout va bien.
2. **Pools** — la part du hashrate de la flotte envoyée à chaque pool.

Chaque pastille filtre la liste des mineurs en dessous ; un second clic
retire le filtre.

---

## 🔍 Recherche, filtres & tri
{: #recherche-filtres-tri }

![Recherche, filtres et tri]({{ '/assets/images/toolbar.png' | relative_url }})

1. **Recherche** — texte libre (nom, IP, modèle, pool, utilisateur
   stratum, version firmware) ou comparaisons : `temp>60`, `fan<=50`,
   `power>15`, `hashrate<0.3`, `uptime>3600` (secondes). Mot-clé `offline`
   (négation avec `!offline`/`-offline`). Plusieurs termes séparés par un
   espace doivent tous correspondre ; négation avec `-`/`!`.
2. **Astuces** — rappel de cette syntaxe.
3. **Tri** — plus chaud (par défaut), hashrate, ventilateur le plus
   rapide, plus de parts, plus ancien (uptime total) ou pool (A-Z),
   mémorisé entre les visites. Quel que soit le tri, les mineurs à
   problème restent en tête, du plus urgent au moins urgent.
4. **Modèle** — filtre par type de mineur, avec le nombre de mineurs
   pour chacun.
5. **Firmware** — filtre par version firmware, avec le nombre de mineurs
   pour chacune.
6. **Affichage** — liste ou tuiles, mémorisé entre les visites. Sur
   téléphone, les mineurs s'affichent toujours en tuiles.
7. **Compteur** — nombre de mineurs affichés sur le total.

---

## 📋 La liste des mineurs
{: #liste }

![La liste des mineurs]({{ '/assets/images/miner-list.png' | relative_url }})

1. **Mineur** — alias ou hostname, puis l'IP et le modèle.
2. **Hashrate · 24 h** — le hashrate des dernières 24 h et sa valeur
   actuelle. Les périodes où le mineur était injoignable apparaissent en
   rouge sur la ligne de base.
3. **Temp. puce** — température des puces, sur une jauge verte qui passe
   à l'orange à l'approche du seuil de 62 °C (marqué d'un trait), puis au
   rouge une fois atteint.
4. **Ventilateur** — vitesse du ventilateur, sur la même jauge, avec un
   seuil à 75 %.
5. **Conso.** — puissance (W) et rendement (J/TH).
6. **Pool** — le pool actif, cliquable vers son tableau de bord quand un
   lien est connu pour lui (voir
   [Configuration]({{ '/configuration.html#electricite-pools' | relative_url }})),
   et s'il s'agit du pool **Principal** ou de **Secours**.
7. **Firmware** — version installée ; en dessous, en bleu, la nouvelle
   version disponible s'il y en a une.
8. **État** — le liseré à gauche prend la couleur de
   [l'état du mineur](#etat-pools).
9. **Détail** — un clic n'importe où sur la ligne ouvre
   [le détail du mineur](#detail).

En tuiles, chaque mineur reprend les mêmes informations, avec son état
écrit en toutes lettres :

![Les mineurs en tuiles]({{ '/assets/images/miner-tiles.png' | relative_url }}){: width="580" }

---

## 🔎 Le détail d'un mineur
{: #detail }

Un panneau qui s'ouvre sur la droite (plein écran sur téléphone) ; il se
ferme avec la croix, en cliquant à côté, ou d'un glissement vers la
droite sur téléphone.

<div class="shot-aside" markdown="1">

![Le détail d'un mineur]({{ '/assets/images/drawer.png' | relative_url }}){: width="340" }

1. **Nom et état** — le liseré du haut reprend la couleur de l'état.
2. **IP** — lien direct vers l'interface du mineur, suivi de son modèle.
3. **Mesures** — hashrate des dernières 24 h, puissance et rendement,
   température des puces et ventilateur avec leur seuil.
4. **Dernières 24 h** — graphique de la température, du ventilateur, du
   hashrate ou du ping, sur la dernière heure (**1H**) ou les dernières
   24 h (**24H**).
5. **Pools** — le pool principal et celui de secours, le pool actif
   marqué **Actif** ; chacun est cliquable vers son tableau de bord quand
   un lien est connu pour lui.
6. **Utilisateur** — l'utilisateur stratum du pool sélectionné, à copier
   en un clic. Cliquer sur l'autre pool affiche le sien.
7. **Session** — parts acceptées et rejetées, meilleure difficulté et
   temps de fonctionnement depuis le dernier redémarrage.
8. **Depuis le début** — parts acceptées, temps de fonctionnement et
   électricité dépensée depuis la toute première mise en route.
9. **Appareil** — version firmware, adresse MAC, ping du pool et heure du
   dernier relevé.
10. **Actions** — **Redémarrer** le mineur ou **Basculer** sur l'autre
    pool (le mineur redémarre pour l'appliquer), toujours après
    confirmation.

</div>

Quand le mineur a un problème, un bandeau le détaille juste sous
l'en-tête : injoignable, aucun relevé depuis une heure donnée, erreur de
configuration, température ou ventilateur au seuil. Une nouvelle version
firmware s'annonce dans un bandeau bleu, avec un lien vers sa release.
