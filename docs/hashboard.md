---
title: Hashboard
nav_order: 10.5
group: Remote
subnav:
  - title: Fonctionnement
    anchor: fonctionnement
  - title: Actions à distance
    anchor: actions-a-distance
  - title: Protection des données
    anchor: protection-des-donnees
  - title: Dans le dashboard
    anchor: dans-le-dashboard
---

# Hashboard

<div class="toc-grid">
  <a href="#fonctionnement" class="toc-card">
    <span class="toc-card-icon">🔄</span>
    <span class="toc-card-title">Fonctionnement</span>
  </a>
  <a href="#actions-a-distance" class="toc-card">
    <span class="toc-card-icon">🕹️</span>
    <span class="toc-card-title">Actions à distance</span>
  </a>
  <a href="#protection-des-donnees" class="toc-card">
    <span class="toc-card-icon">🔒</span>
    <span class="toc-card-title">Protection des données</span>
  </a>
  <a href="#dans-le-dashboard" class="toc-card">
    <span class="toc-card-icon">🧭</span>
    <span class="toc-card-title">Dans le dashboard</span>
  </a>
</div>

Suivez vos mineurs depuis n'importe où : le dashboard envoie leurs stats à
[hashboard.live](https://hashboard.live), qui les affiche sur votre board.

Le board est la page d'accueil de votre flotte, accessible hors de chez
vous — hashrate sur 24 h, indicateurs, état des mineurs, pools et liste
des mineurs — rafraîchie automatiquement, dans la langue du navigateur.
Il peut être public ou privé.

Rien à ouvrir sur votre réseau, ni port ni VPN : c'est votre dashboard qui
envoie, hashboard ne s'y connecte jamais. L'envoi se configure dans
Configuration › Distant.

[Aller à Distant →]({{ '/configuration.html#distant' | relative_url }}){: .btn .btn-primary }

{: .protection }
> 🔒 **Vos données personnelles restent chez vous.** hashboard est un
> service tiers. Par défaut, votre wallet, vos pools et l'adresse de vos
> mineurs sur votre réseau local sont offusqués avant l'envoi : hashboard
> ne les reçoit pas, ne les stocke pas et ne peut donc jamais les exposer,
> même sur un board public.

---

## 🔄 Fonctionnement
{: #fonctionnement }

Une fois l'envoi configuré, le feeder envoie à hashboard, à chaque cycle
et pour chaque mineur :

- **le relevé** — les mesures, le nom (ou l'alias), le modèle, le tarif du
  kWh, la dernière release du firmware, l'intervalle du feeder et les
  seuils d'alerte du mineur, avec les données personnelles offusquées ;
- **les totaux** — temps de fonctionnement, parts acceptées et rejetées,
  coût d'électricité ;
- **une ligne « hors ligne »** quand le mineur ne répond pas : le graphe
  24 h du board chute à 0 comme en local.

Et, une fois pour tout le board, **ses réglages** : les actions à distance
autorisées, envoyées seulement quand elles changent.

Les envois partent en arrière-plan : un hashboard lent ou injoignable ne
retarde jamais le cycle, l'échec est écrit dans les logs. Un réglage
modifié s'applique au cycle suivant.

[Voir le détail dans Feeder →]({{ '/feeder.html#hashboard' | relative_url }}){: .btn .btn-primary }

---

## 🕹️ Actions à distance
{: #actions-a-distance }

Sur un board **privé**, le panneau d'un mineur qui envoie ses données garde
ses boutons **Redémarrer** et **Basculer**, pour les actions que le
dashboard autorise (*Configuration › Distant*).

1. Le board dépose la demande sur hashboard.
2. Le dashboard la récupère dans la minute — il ne demande rien à hashboard
   tant qu'aucune action n'est autorisée.
3. Il vérifie qu'elle est toujours autorisée et que le mineur est l'un des
   siens, la fait comme ses propres boutons et l'inscrit dans l'audit.
4. Le board affiche *Demande en cours*, puis *Demande récupérée* avec
   l'heure, boutons grisés. Chaque état dure au plus deux intervalles de
   récupération : une demande non récupérée à temps expire sans être
   exécutée.

Une seule demande à la fois par mineur. Le résultat de l'action est dans
l'audit du dashboard, et dans le mail si vous l'avez activé.

[Voir le réglage →]({{ '/configuration.html#distant' | relative_url }}){: .btn .btn-primary }

---

## 🔒 Protection des données
{: #protection-des-donnees }

Votre wallet, vos pools et votre réseau local sont des données
personnelles. Avant chaque envoi, le dashboard les **offusque** : le champ
reste, sa valeur est remplacée par `xxxxxxxx` (`0` pour un port) —
hashboard ne reçoit donc jamais la donnée, et le board ne l'affiche pas.

### Toujours offusqué

<table class="data-table">
  <thead>
    <tr>
      <th>Donnée</th>
      <th>Envoyée à hashboard</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Nom du réseau Wi-Fi</td>
      <td><code>xxxxxxxx</code></td>
    </tr>
    <tr>
      <td>Adresse IPv6 du mineur</td>
      <td><code>xxxxxxxx</code></td>
    </tr>
  </tbody>
</table>

### Offusqué par défaut

À partager seulement si vous le choisissez, dans Configuration › Distant :

<table class="data-table">
  <thead>
    <tr>
      <th>Réglage</th>
      <th>Désactivé (par défaut)</th>
      <th>Activé</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Utilisateur / wallet des pools</td>
      <td><code>xxxxxxxx</code></td>
      <td>l'utilisateur des pools principale et de secours</td>
    </tr>
    <tr>
      <td>Pools (adresse et port)</td>
      <td><code>xxxxxxxx</code>, port <code>0</code></td>
      <td>l'adresse et le port des pools principale et de secours</td>
    </tr>
    <tr>
      <td>Adresse IP des mineurs</td>
      <td>une adresse fictive tirée de l'adresse MAC : <code>aa:bb:cc:dd:ee:ff</code> devient <code>fd00::aabb:ccdd:eeff</code></td>
      <td>l'IP de chaque mineur sur votre réseau</td>
    </tr>
  </tbody>
</table>

L'adresse fictive ne dit rien de votre réseau : elle sert seulement au
board à reconnaître chaque mineur, et c'est elle qu'il affiche.

Seul l'envoi est offusqué : votre dashboard garde toutes les données en
local — accueil, historique, sauvegardes, audit.

---

## 🧭 Dans le dashboard
{: #dans-le-dashboard }

Une fois l'envoi configuré, votre board apparaît dans le dashboard
lui-même :

- **Menu** — sous *AxeOS · D#hashboard*, l'identifiant du board (clic pour
  ouvrir le board), s'il est public ou privé, et un lien vers votre compte
  hashboard.
- **Accueil** — sous le titre de la page, un lien *Ouvrir le board
  distant* et l'heure des dernières données reçues par hashboard.
