---
title: Alertes
nav_order: 4
group: Pages
subnav:
  - title: Types d'alertes
    anchor: types
---

# Alertes

Historique des alertes détectées par le feeder, un jour à la fois —
aujourd'hui par défaut, ou un autre jour via le calendrier. Accessible
depuis le menu.

![Page Alertes]({{ '/assets/images/alerts.png' | relative_url }})

Une alerte n'apparaît que lorsqu'elle change d'état : une ligne quand
elle commence (rouge, orange pour une mise à jour firmware), une ligne
quand elle se termine (verte), avec depuis quand elle durait, sa durée et,
pour la température et le ventilateur, la valeur la plus haute atteinte
(ex. « 28/10 14:18 → 28/10 16:28 · a duré 2h 10m · pic à 99% »). Entre les deux, rien : une
température qui reste haute pendant des heures tient en deux lignes.

Pour qu'une valeur qui oscille autour du seuil ne déclenche pas une
alerte à chaque relevé, le retour à la normale se fait sous un seuil plus
bas que le déclenchement (voir le tableau ci-dessous). Un mineur n'est
déclaré hors ligne qu'après 2 relevés manqués de suite.

Les mêmes changements d'état alimentent les notifications de la cloche,
et un mail à chaque nouvelle alerte si
[Configuration › Notifications]({{ '/configuration.html#notifications' | relative_url }})
l'active.

Les alertes **en cours** — commencées et pas encore terminées, quel que
soit leur âge — restent en haut de la page, au-dessus de l'historique du
jour choisi, avec depuis quand elles durent ; pour la température et le
ventilateur, la valeur affichée est celle du dernier relevé du mineur,
avec celle du début (ex. « Atchoum : ventilateur à 99% · 26/10 14:18 ·
depuis 3j 2h 0m · 83% au début »). Leur nombre s'affiche aussi en badge sur l'entrée Alertes du
menu : rouge dès qu'une est un problème, orange s'il ne reste que des
mises à jour firmware, « 9+ » au-delà de 9. Il ne baisse que lorsqu'une
alerte se termine.

Filtrable par mineur, par type et par jour (les alertes en cours suivent
le mineur et le type). À côté du jour, **‹** et **›** passent au jour
précédent ou suivant et **Aujourd'hui** y revient — sur téléphone, ils
restent visibles quand les filtres sont repliés. Chaque filtre actif
apparaît en étiquette sous la barre : la croix le retire, **Tout effacer**
les retire tous.

## ⚠️ Types d'alertes
{: #types }

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Déclenchement</th>
      <th>Retour à la normale</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Température haute</td>
      <td>Puce &gt; 62°C</td>
      <td>Puce &lt; 60°C</td>
    </tr>
    <tr>
      <td>Ventilateur haut</td>
      <td>Vitesse &gt; 75%</td>
      <td>Vitesse &lt; 70%</td>
    </tr>
    <tr>
      <td>Mise à jour firmware</td>
      <td>Version du mineur en retard sur la dernière release GitHub</td>
      <td>Mineur à jour</td>
    </tr>
    <tr>
      <td>Hors ligne</td>
      <td>Mineur injoignable 2 relevés de suite</td>
      <td>Le mineur répond de nouveau</td>
    </tr>
    <tr>
      <td>Configuration incohérente</td>
      <td>La <code>mac:</code> configurée ne correspond pas à ce que le mineur reporte</td>
      <td>Le bon appareil répond de nouveau</td>
    </tr>
  </tbody>
</table>
