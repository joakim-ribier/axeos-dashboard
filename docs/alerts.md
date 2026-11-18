---
title: Alertes
nav_order: 4
group: Pages
subnav:
  - title: La page
    anchor: page
  - title: En cours
    anchor: en-cours
  - title: Types d'alertes
    anchor: types
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#page" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-text">
      <span class="toc-card-title">La page</span>
      <span class="toc-card-sub">Les filtres et les alertes d'un jour</span>
    </span>
  </a>
  <a href="#en-cours" class="toc-card">
    <span class="toc-card-icon">🔴</span>
    <span class="toc-card-text">
      <span class="toc-card-title">En cours</span>
      <span class="toc-card-sub">Ce qui dure encore, et le badge du menu</span>
    </span>
  </a>
  <a href="#types" class="toc-card">
    <span class="toc-card-icon">⚠️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Types d'alertes</span>
      <span class="toc-card-sub">Quand chacune commence et se termine</span>
    </span>
  </a>
</div>

Les alertes de tes mineurs : celles en cours, et l'historique d'un jour.

## 📋 La page
{: #page }

![Page Alertes]({{ '/assets/images/alerts.png' | relative_url }}){: width="723" }

1. Mineur — un mineur, ou tous.
2. Type — un type d'alerte, ou tous.
3. Jour — le jour affiché, aujourd'hui par défaut.
4. ‹ Aujourd'hui › — le jour précédent, le suivant, ou retour à aujourd'hui ;
   toujours visibles sur téléphone, filtres repliés.
5. Filtres actifs — un par étiquette : la croix le retire, *Tout effacer*
   les retire tous.
6. Une alerte qui commence — en rouge (en orange pour une mise à jour
   firmware), avec la valeur et l'heure.
7. Une alerte qui se termine — en vert, avec son début, sa durée et la
   valeur la plus haute atteinte.

Une alerte tient en deux lignes, son début et sa fin, même si elle dure des
heures. Chacune arrive aussi dans les notifications de la cloche, et par
mail si tu l'actives.
[Configuration › Notifications]({{ '/configuration.html#notifications' | relative_url }}){: .link-page }

---

## 🔴 En cours
{: #en-cours }

Les alertes pas encore terminées restent en haut de la page, au-dessus de
l'historique, quel que soit le jour de leur début. Elles suivent les
filtres du mineur et du type. Pour la température et le ventilateur, la
valeur affichée est celle du dernier relevé, avec celle du début et la
valeur sous laquelle l'alerte se termine.

Leur nombre s'affiche en badge sur *Alertes* dans le menu : rouge dès qu'une
est un problème, orange s'il ne reste que des mises à jour firmware.

---

## ⚠️ Types d'alertes
{: #types }

Pour qu'une valeur qui oscille autour de son seuil reste une seule alerte,
la température et le ventilateur reviennent à la normale sous leur seuil
moins une marge. Un mineur passe hors ligne après 2 relevés manqués de
suite.

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Commence</th>
      <th>Se termine</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Température</td>
      <td>Puce au-dessus du seuil (62 °C par défaut)</td>
      <td>Sous le seuil moins la marge (2 °C par défaut)</td>
    </tr>
    <tr>
      <td>Ventilateur</td>
      <td>Vitesse au-dessus du seuil (75 % par défaut)</td>
      <td>Sous le seuil moins la marge (5 % par défaut)</td>
    </tr>
    <tr>
      <td>Mise à jour firmware</td>
      <td>Une version plus récente est sortie sur GitHub</td>
      <td>Le mineur est à jour</td>
    </tr>
    <tr>
      <td>Hors ligne</td>
      <td>Pas de réponse à 2 relevés de suite</td>
      <td>Le mineur répond de nouveau</td>
    </tr>
    <tr>
      <td>Erreur de configuration</td>
      <td>La MAC configurée n'est pas celle du mineur</td>
      <td>Le bon appareil répond de nouveau</td>
    </tr>
  </tbody>
</table>

Les seuils se règlent pour tous tes mineurs, ou pour un seul dans son
panneau ; les marges, communes à tous, au même endroit.
[Configuration › Système]({{ '/configuration.html#systeme' | relative_url }}){: .link-page }

{% include page_nav.html position="bottom" %}
