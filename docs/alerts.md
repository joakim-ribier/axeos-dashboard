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
quand elle se termine (verte), avec sa durée. Entre les deux, rien : une
température qui reste haute pendant des heures tient en deux lignes.

Pour qu'une valeur qui oscille autour du seuil ne déclenche pas une
alerte à chaque relevé, le retour à la normale se fait sous un seuil plus
bas que le déclenchement (voir le tableau ci-dessous). Un mineur n'est
déclaré hors ligne qu'après 2 relevés manqués de suite.

Les mêmes changements d'état alimentent les notifications de la cloche.

Filtrable par mineur, par type et par jour. Chaque filtre actif apparaît
en étiquette sous la barre : la croix le retire, **Tout effacer** les
retire tous.

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
