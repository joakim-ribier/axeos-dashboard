---
title: Feeder
nav_order: 6.7
group: Services
subnav:
  - title: Son rôle
    anchor: role
  - title: Chaque cycle
    anchor: cycle
  - title: Fichiers écrits
    anchor: fichiers
  - title: Envoi vers hashboard
    anchor: hashboard
  - title: Firmware
    anchor: firmware-update-detection
  - title: Sauvegardes
    anchor: sauvegardes
  - title: Logs et arrêt
    anchor: logs
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#role" class="toc-card">
    <span class="toc-card-icon">🎯</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Son rôle</span>
      <span class="toc-card-sub">Relever, enregistrer, alerter</span>
    </span>
  </a>
  <a href="#cycle" class="toc-card">
    <span class="toc-card-icon">🔁</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Chaque cycle</span>
      <span class="toc-card-sub">Étape par étape</span>
    </span>
  </a>
  <a href="#fichiers" class="toc-card">
    <span class="toc-card-icon">🗂️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Fichiers écrits</span>
      <span class="toc-card-sub">L'historique sur le disque</span>
    </span>
  </a>
  <a href="#hashboard" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Envoi vers hashboard</span>
      <span class="toc-card-sub">Ce qui part, et quand</span>
    </span>
  </a>
  <a href="#firmware-update-detection" class="toc-card">
    <span class="toc-card-icon">⬆️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Firmware</span>
      <span class="toc-card-sub">La dernière version de chaque modèle</span>
    </span>
  </a>
  <a href="#sauvegardes" class="toc-card">
    <span class="toc-card-icon">📦</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Sauvegardes</span>
      <span class="toc-card-sub">L'archive de chaque mois</span>
    </span>
  </a>
  <a href="#logs" class="toc-card">
    <span class="toc-card-icon">📜</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Logs et arrêt</span>
      <span class="toc-card-sub">Où il écrit, comment il s'arrête</span>
    </span>
  </a>
</div>

Le service qui relève tes mineurs à intervalle régulier et enregistre leur
historique sur le disque, d'où le dashboard le lit.

## 🎯 Son rôle
{: #role }

Le seul service qui collecte les données des mineurs. Il tourne en continu,
à côté de dashboard-api et du mailer :

- Relever — chaque mineur activé, à chaque cycle.
- Enregistrer — chaque relevé dans l'historique du jour, avec le dernier
  relevé et les totaux de chaque mineur.
- Suivre les alertes — température, ventilateur, firmware, hors ligne, MAC
  différente : chacune notée quand elle commence et quand elle se termine.
- Envoyer à hashboard — les statistiques, si l'envoi est configuré.
- Vérifier le firmware — la dernière release de chaque modèle.
- Sauvegarder — chaque journée terminée, dans l'archive de son mois.

dashboard-api lit ces fichiers pour l'écran d'accueil, les alertes et les
graphiques ; c'est lui qui fait les actions sur les mineurs.

---

## 🔁 Chaque cycle, étape par étape
{: #cycle }

Un cycle tourne au démarrage, puis toutes les `feeder.interval` de
`dashboard.yml` (2 minutes dans la configuration d'exemple).

1. Relire la configuration — `miners.yml` et `settings.yml`, quand ils ont
   changé : un mineur ajouté, un tarif modifié dans Configuration
   s'appliquent dès ce cycle.
2. Pour chaque mineur activé, dans l'ordre de `miners.yml` :
   1. Vérifier sa MAC — sans `mac`, le mineur est ignoré (erreur dans les
      logs) : son historique est rangé sous sa MAC.
   2. L'interroger — `GET /api/system/info` à son IP, avec le délai
      `endpoints.timeout` (5 s par défaut).
   3. S'il ne répond pas — une ligne « hors ligne » dans l'historique du jour
      (`latest.json` garde le dernier relevé), aussi envoyée à hashboard ; au
      2ᵉ relevé manqué de suite, l'alerte « hors ligne » commence.
   4. Si sa MAC n'est pas celle configurée (un autre appareil à cette IP, ou
      une faute de frappe) — le relevé est refusé, et l'alerte « MAC
      différente » commence.
   5. Suivre les alertes — comparées au relevé précédent : seules celles
      qui commencent ou se terminent sont notées. La température et le
      ventilateur suivent les seuils du mineur, le firmware la dernière
      release de son modèle.
   6. Enregistrer — la ligne du relevé (mesures, tarif du kWh) dans
      l'historique du jour ; `latest.json` est remplacé, et `totals.json`
      cumule le temps de fonctionnement, les parts et le coût d'électricité.
   7. Envoyer à hashboard — le relevé et les totaux, si l'envoi est
      configuré.
3. Passer les nouvelles alertes au mailer — toutes celles du cycle, en un
   appel, si le mail des alertes est activé ; le cycle ne l'attend pas.
4. Vérifier le firmware — pour chaque modèle configuré, quand la dernière
   release en cache a plus de `firmware.cacheTTL`.

Un mineur désactivé n'est plus relevé ; son historique reste sur le disque.
Les alertes en cours sont gardées d'un cycle et d'un redémarrage à l'autre.
[Alertes]({{ '/alerts.html' | relative_url }}){: .link-page }

---

## 🗂️ Fichiers écrits
{: #fichiers }

Tout est rangé sous le `storage.dataDir` de `dashboard.yml` :

```text
{dataDir}/data/bitaxes/
  aabbccddeeff/              ← un dossier par mineur, nommé par sa MAC
    2026-10-18.jsonl         ← l'historique du jour (UTC), une ligne par cycle
    latest.json              ← le dernier relevé réussi
    totals.json              ← les totaux depuis le début du suivi
    alerts.json              ← ses alertes en cours
  firmware_cache.json        ← la dernière release connue de chaque modèle
{dataDir}/data/backups/      ← les archives mensuelles
{dataDir}/data/audit/        ← l'audit, où le feeder note ses sauvegardes
{dataDir}/data/alerts/       ← les alertes, un fichier par jour (UTC)
```

- Historique du jour — un fichier par jour UTC, seulement complété. Chaque
  ligne a l'heure, la réponse brute du mineur et le tarif du kWh ; une ligne
  « hors ligne », l'heure et son alerte.
- Dernier relevé — ce que l'écran d'accueil affiche pour chaque mineur.
- Alertes — une ligne par alerte qui commence ou se termine : la page
  Alertes et la cloche.
- Totaux — temps de fonctionnement, parts, coût d'électricité. Ils
  continuent quand le mineur redémarre et quand le tarif change : chaque
  relevé compte au tarif de son heure.

Le dossier d'un mineur vient de sa MAC : un mineur qui change d'IP garde
son historique.
[Scripts › rebuild-totals]({{ '/rebuild-totals.html' | relative_url }}){: .link-page }

---

## ☁️ Envoi vers hashboard
{: #hashboard }

Quand l'URL d'envoi et la clé API sont renseignées (Configuration ›
Distant), le feeder envoie à chaque cycle, pour chaque mineur :

- le relevé (`…/api/push`) — les mesures, le nom, le modèle, le tarif, la
  dernière release du firmware et l'intervalle du feeder ; le wallet, les
  pools et l'IP masqués, sauf si tu choisis de les partager ;
- les totaux (`…/api/push/totals`) ;
- une ligne « hors ligne » (`…/api/push/history`) quand le mineur ne répond
  pas : le graphique 24 h du board chute à 0, comme en local.

Seul l'envoi est masqué : le relevé local reste complet. Les envois partent
en arrière-plan, avec un délai de 10 s : un hashboard lent ne retarde pas
le cycle, et un échec est écrit dans les logs.

À chaque cycle, le feeder lit aussi la limite de mineurs de ton board : au-delà,
seuls les premiers mineurs activés, dans l'ordre de la configuration, sont
envoyés.
[Hashboard]({{ '/hashboard.html' | relative_url }}){: .link-page }

---

## ⬆️ Détection des mises à jour firmware
{: #firmware-update-detection }

Le feeder demande à GitHub la dernière release de chaque modèle configuré,
une fois par `firmware.cacheTTL` (24 h par défaut), et la garde dans
`{dataDir}/data/bitaxes/firmware_cache.json`. Chaque mineur de l'API porte :

```json
{
  "version": "v2.4.0",
  "latestVersion": "v2.5.1",
  "updateAvailable": true
}
```

`updateAvailable` vaut `true` quand une version plus récente existe : la
liste des mineurs et leur détail l'affichent.
[La liste des mineurs]({{ '/dashboard.html#liste' | relative_url }}){: .link-page }

---

## 📦 Sauvegardes mensuelles
{: #sauvegardes }

Toutes les heures, le feeder ajoute chaque journée terminée (UTC) pas encore
archivée à l'archive de son mois, `{dataDir}/data/backups/YYYY-MM.zip` — en
pratique la veille, juste après minuit UTC. L'archive n'est remplacée
qu'une fois entièrement écrite. Un mois terminé a son MD5 dans
`checksums.md5` : son archive ne change plus. Tout cela tourne à côté des
relevés, sans les retarder ; une sauvegarde qui archive au moins un jour,
ou qui échoue, est notée dans l'audit (type `backup`).
[Sauvegardes]({{ '/backups.html' | relative_url }}){: .link-page }

---

## 📜 Logs et arrêt
{: #logs }

- Logs — dans `{dataDir}/logs/feeder.log` (une ligne JSON par événement),
  ou dans la console quand `global.env` vaut `dev` : chaque cycle, chaque
  erreur d'un mineur, chaque envoi raté et chaque sauvegarde.
- Arrêt — proprement, sur `SIGINT` / `SIGTERM`.
- Au démarrage — un mineur activé sans `mac` est signalé dans les logs.

{% include page_nav.html position="bottom" %}
