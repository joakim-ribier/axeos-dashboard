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

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#sidebar" class="toc-card">
    <span class="toc-card-icon">☰</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Menu</span>
      <span class="toc-card-sub">Les pages, ton board et l'état des services</span>
    </span>
  </a>
  <a href="#top-bar" class="toc-card">
    <span class="toc-card-icon">🔔</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Barre du haut</span>
      <span class="toc-card-sub">Doc, actualisation, notifications, langue</span>
    </span>
  </a>
  <a href="#flotte" class="toc-card">
    <span class="toc-card-icon">📊</span>
    <span class="toc-card-text">
      <span class="toc-card-title">La flotte</span>
      <span class="toc-card-sub">Hashrate 24 h, puissance, coût, parts</span>
    </span>
  </a>
  <a href="#etat-pools" class="toc-card">
    <span class="toc-card-icon">🚦</span>
    <span class="toc-card-text">
      <span class="toc-card-title">État & pools</span>
      <span class="toc-card-sub">Tes mineurs par état, le hashrate par pool</span>
    </span>
  </a>
  <a href="#recherche-filtres-tri" class="toc-card">
    <span class="toc-card-icon">🔍</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Recherche & tri</span>
      <span class="toc-card-sub">Trouver un mineur, ranger la liste</span>
    </span>
  </a>
  <a href="#liste" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-text">
      <span class="toc-card-title">La liste</span>
      <span class="toc-card-sub">Chaque mineur sur une ligne, ou en tuiles</span>
    </span>
  </a>
  <a href="#detail" class="toc-card">
    <span class="toc-card-icon">🔎</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Le détail</span>
      <span class="toc-card-sub">Tout sur un mineur, redémarrage et bascule</span>
    </span>
  </a>
</div>

## ☰ Menu
{: #sidebar }

<div class="shot-aside" markdown="1">

![Menu]({{ '/assets/images/sidebar-only.png' | relative_url }}){: width="225" }

1. AxeOS · D#hashboard — recharge l'app et revient à l'accueil.
2. [Board hashboard]({{ '/hashboard.html' | relative_url }}){: .link-page } —
   quand l'envoi vers hashboard est configuré : l'identifiant du board (clic
   pour l'ouvrir), public ou privé, et un lien vers ton compte.
3. Accueil — tous tes mineurs.
4. [Alertes]({{ '/alerts.html' | relative_url }}){: .link-page } — en cours
   et historique ; le badge compte celles en cours.
5. [Configuration]({{ '/configuration.html' | relative_url }}){: .link-page } —
   mineurs, électricité, notifications, distant, système.
6. [Sauvegardes]({{ '/backups.html' | relative_url }}){: .link-page } — les
   archives mensuelles de l'historique.
7. [Audit]({{ '/audit.html' | relative_url }}){: .link-page } — tout ce qui
   agit sur un mineur ou sur la configuration.
8. État plateforme — vert quand tout tourne, orange quand un service a
   manqué un passage, rouge quand l'un ne répond plus.
   [Le détail](#etat-plateforme){: .link-page }
9. Pied du menu — la version déployée, « Mise à jour disponible » quand
   une nouvelle version est sortie (clic pour ouvrir la release), et le
   bouton pour replier le menu en colonne d'icônes.

</div>

Sur téléphone, le menu s'ouvre avec le bouton ☰ de la barre du haut.

### État plateforme
{: #etat-plateforme }

Un clic sur *État plateforme* affiche l'état de chaque service, relu à
chaque ouverture :

![État des services]({{ '/assets/images/services-status.png' | relative_url }}){: width="347" }

Un service est *En retard* quand il n'a rien fait depuis deux intervalles,
*Injoignable* quand il ne répond pas, et *Aucun passage* tant qu'il n'a
pas encore tourné.

---

## 🔔 Barre du haut
{: #top-bar }

Toujours visible, même en faisant défiler la page.

![Barre du haut]({{ '/assets/images/topbar-only.png' | relative_url }}){: width="736" }

1. Page — icône, titre et description de la page.
2. Documentation — ouvre cette doc.
3. Actualisation auto — active (bleu) ou coupe (gris) le rafraîchissement
   des données ; gardé par le navigateur.
4. Notifications — les alertes qui commencent ou se terminent, et les
   événements récents ; le badge compte les non lues. Un clic les marque
   lues sur tous les appareils.
5. Langue — français ou anglais.

Sur téléphone, la barre garde l'essentiel :

![Barre du haut sur téléphone]({{ '/assets/images/topbar-mobile.png' | relative_url }}){: width="287" }

1. Menu — ouvre le menu.
2. Page — icône et titre.
3. Actualisation auto
4. Notifications
5. Plus — déplie la doc et la langue sous la barre.

---

## 📊 La flotte
{: #flotte }

![La flotte]({{ '/assets/images/fleet.png' | relative_url }}){: width="736" }

1. Hashrate de la flotte · 24 h — la production de tous tes mineurs.
2. Santé — les mineurs sans problème sur le total, dans la couleur du
   problème le plus urgent. Un clic déplie tous les mineurs, ceux à problème
   en tête ; un clic sur l'un ouvre son détail.
   [Le détail d'un mineur](#detail){: .link-page }

   ![Liste des mineurs sous la santé]({{ '/assets/images/fleet-health.png' | relative_url }}){: width="259" }

3. Dernier relevé — son heure. En rouge quand il date de plus de 2
   intervalles : le feeder ne tourne plus.
4. Hashrate actuel — celui des mineurs joignables, et la moyenne sur 24 h.
5. Graphique 24 h — le hashrate de la flotte par tranches de 15 minutes ;
   une période sans relevé apparaît en gris.
6. Puissance — la consommation totale ; en dessous, le mineur qui consomme
   le moins ↓ et le plus ↑.
7. Efficacité — le rendement de la flotte (J/TH) ; en dessous, le meilleur
   ↓ et le moins bon ↑.
8. Électricité — le coût par jour, au tarif configuré, mineurs et autres
   appareils compris ; en dessous, le total dépensé depuis le début, que
   changer de tarif ne modifie pas.
   [Configuration › Électricité]({{ '/configuration.html#electricite' | relative_url }}){: .link-page }
9. Parts — les parts acceptées depuis le démarrage des mineurs ; en
   dessous, depuis leur première mise en route.
10. Meilleure diff. — la meilleure difficulté, et le mineur qui la détient.
11. Température — la plus basse ↓ et la plus haute ↑ des puces ; en
    dessous, le ventilateur le plus rapide.

---

## 🚦 État des mineurs & pools
{: #etat-pools }

![État des mineurs et pools]({{ '/assets/images/breakdowns.png' | relative_url }}){: width="736" }

1. État des mineurs — leur répartition, du plus urgent au moins urgent :
   - Hors ligne — le mineur ne répond plus.
   - Erreur de config — la MAC configurée n'est pas celle du mineur
     (mauvais appareil à cette IP, ou faute de frappe).
   - En retard — le mineur répond, mais aucun relevé depuis plus de 2
     intervalles.
   - En alerte — température ou ventilateur au-dessus du seuil (62 °C et
     75 % par défaut), jusqu'au retour à la normale.
   - En ligne — tout va bien.
2. Pools — la part du hashrate envoyée à chaque pool.

Chaque pastille filtre la liste en dessous ; un second clic retire le
filtre.

---

## 🔍 Recherche, filtres & tri
{: #recherche-filtres-tri }

![Recherche, filtres et tri]({{ '/assets/images/toolbar.png' | relative_url }}){: width="736" }

1. Recherche — du texte (nom, IP, modèle, pool, utilisateur, firmware) ou
   des comparaisons : `temp>60`, `fan<=50`, `power>15`, `hashrate<0.3`,
   `uptime>3600` (secondes), `offline`. Plusieurs termes se cumulent ; `-`
   ou `!` devant un terme l'exclut.
2. Astuces — le rappel de cette syntaxe.
3. Tri — plus chaud (par défaut), hashrate, ventilateur, parts, plus
   ancien ou pool. Les mineurs à problème restent toujours en tête.
4. Modèle — un filtre par type de mineur, avec leur nombre.
5. Firmware — un filtre par version, avec leur nombre.
6. Affichage — liste ou tuiles ; toujours en tuiles sur téléphone.
7. Compteur — les mineurs affichés sur le total.

Le tri et l'affichage sont gardés d'une visite à l'autre.

---

## 📋 La liste des mineurs
{: #liste }

![La liste des mineurs]({{ '/assets/images/miner-list.png' | relative_url }}){: width="736" }

1. Mineur — son nom, son IP et son modèle.
2. Hashrate · 24 h — la courbe des dernières 24 h et la valeur actuelle ;
   en rouge sur la ligne de base, les périodes où il ne répondait pas.
3. Temp. puce — sur une jauge verte, jaune à l'approche du seuil (le trait,
   62 °C par défaut), rouge pendant l'alerte.
4. Ventilateur — la même jauge, avec son seuil (75 % par défaut).
5. Conso. — puissance (W) et rendement (J/TH).
6. Pool — le pool actif, principal ou de secours ; cliquable vers son
   dashboard quand un lien est connu.
   [Configuration › Système]({{ '/configuration.html#systeme' | relative_url }}){: .link-page }
7. Firmware — la version installée ; en bleu dessous, la nouvelle s'il y
   en a une.
8. État — le liseré à gauche, dans la couleur de l'état du mineur.
   [État des mineurs](#etat-pools){: .link-page }
9. Détail — un clic sur la ligne ouvre le détail du mineur.
   [Le détail d'un mineur](#detail){: .link-page }

En tuiles, les mêmes informations, avec l'état écrit en toutes lettres :

![Les mineurs en tuiles]({{ '/assets/images/miner-tiles.png' | relative_url }}){: width="495" }

---

## 🔎 Le détail d'un mineur
{: #detail }

Un panneau sur la droite, plein écran sur téléphone. Il se ferme avec la
croix, d'un clic à côté, ou d'un glissement vers la droite.

<div class="shot-aside" markdown="1">

![Le détail d'un mineur]({{ '/assets/images/drawer.png' | relative_url }}){: width="446" }

1. Nom et état — le liseré du haut dans la couleur de l'état.
2. IP — ouvre l'interface du mineur ; puis son modèle.
3. Mesures — hashrate sur 24 h, puissance et rendement, température et
   ventilateur avec leur seuil.
4. Dernières 24 h — température, ventilateur, hashrate ou ping, sur 1 h
   ou 24 h.
5. Pools — le principal et le secours, l'actif marqué ; chacun cliquable
   vers son dashboard quand un lien est connu.
6. Utilisateur — l'utilisateur du pool choisi, à copier en un clic ; un
   clic sur l'autre pool affiche le sien.
7. Session — parts acceptées et rejetées, meilleure difficulté et temps de
   fonctionnement depuis le dernier redémarrage.
8. Depuis le début — parts, temps de fonctionnement et électricité depuis
   la première mise en route.
9. Appareil — firmware, MAC, ping du pool et dernier relevé.
10. Actions — redémarrer le mineur ou le basculer sur l'autre pool (il
    redémarre pour l'appliquer), toujours après confirmation.

</div>

Quand le mineur a un problème, un bandeau le décrit sous l'en-tête :
injoignable, sans relevé depuis une heure donnée, erreur de configuration,
température ou ventilateur au seuil — ou repassés sous le seuil sans être
encore revenus à la normale, avec la valeur à atteindre. Une nouvelle
version firmware s'annonce dans un bandeau bleu, avec le lien vers sa
release.

{% include page_nav.html position="bottom" %}
