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
depuis la sidebar.

![Page Alertes]({{ '/assets/images/alerts.png' | relative_url }})

Plutôt qu'une ligne par sondage — une alerte qui dure des heures créerait
sinon des dizaines de lignes quasi identiques — les occurrences
consécutives d'un même type d'alerte sur un même mineur sont regroupées
en un seul **épisode** : première apparition, dernière apparition, et
nombre d'occurrences (ci-dessus, "61 occurrences" pour les mises à jour
firmware qui durent depuis le début de la journée). Une alerte qui
n'apparaît qu'une seule fois reste affichée sans plage horaire ni
compteur (ex. "Atchoum : ventilateur à 76%" ci-dessus).

Un épisode se termine si l'alerte disparaît pendant plus longtemps que
l'intervalle de sondage du feeder — en dessous de ce délai, une nouvelle
occurrence prolonge le même épisode plutôt que d'en créer un nouveau.

Filtrable par mineur et par type (menus déroulants), avec un bouton pour
réinitialiser les filtres.

## ⚠️ Types d'alertes
{: #types }

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Déclenchement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Température haute</td>
      <td>Puce &gt; 62°C</td>
    </tr>
    <tr>
      <td>Ventilateur haut</td>
      <td>Vitesse &gt; 75%</td>
    </tr>
    <tr>
      <td>Mise à jour firmware</td>
      <td>Version du mineur en retard sur la dernière release GitHub</td>
    </tr>
    <tr>
      <td>Hors ligne</td>
      <td>Mineur injoignable</td>
    </tr>
    <tr>
      <td>Configuration incohérente</td>
      <td>La <code>mac:</code> configurée ne correspond pas à ce que le mineur reporte</td>
    </tr>
  </tbody>
</table>
