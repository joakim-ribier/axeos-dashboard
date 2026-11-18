---
title: Hashboard
nav_order: 6.9
group: Services
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

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#fonctionnement" class="toc-card">
    <span class="toc-card-icon">🔄</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Fonctionnement</span>
      <span class="toc-card-sub">Ce que ton dashboard envoie</span>
    </span>
  </a>
  <a href="#actions-a-distance" class="toc-card">
    <span class="toc-card-icon">🕹️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Actions à distance</span>
      <span class="toc-card-sub">Redémarrer ou basculer depuis ton board</span>
    </span>
  </a>
  <a href="#protection-des-donnees" class="toc-card">
    <span class="toc-card-icon">🔒</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Protection des données</span>
      <span class="toc-card-sub">Ce qui reste chez toi</span>
    </span>
  </a>
  <a href="#dans-le-dashboard" class="toc-card">
    <span class="toc-card-icon">🧭</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Dans le dashboard</span>
      <span class="toc-card-sub">Où ton board apparaît</span>
    </span>
  </a>
</div>

Tes mineurs suivis de n'importe où : ton dashboard envoie leurs
statistiques à [hashboard.live](https://hashboard.live){:target="_blank" rel="noopener noreferrer"},
qui les affiche sur ton board — hashrate sur 24 h, indicateurs, état des
mineurs, pools et liste, rafraîchis tout seuls, dans la langue du
navigateur. Ton board est public ou privé.

Ni port ni VPN à ouvrir : c'est ton dashboard qui envoie, hashboard ne s'y
connecte jamais.
[Configuration › Distant]({{ '/configuration.html#distant' | relative_url }}){: .link-page }

Tes données personnelles restent chez toi. Par défaut, ton wallet, tes pools
et les adresses de tes mineurs sur ton réseau sont masqués avant l'envoi :
hashboard ne les reçoit pas, ne les stocke pas, et ne peut donc pas les
montrer, même sur un board public.
{: .lead-privacy }

---

## 🔄 Fonctionnement
{: #fonctionnement }

Une fois l'envoi configuré, le feeder envoie à chaque cycle, pour chaque
mineur :

- le relevé — les mesures, le nom, le modèle, le tarif du kWh, la dernière
  release du firmware, l'intervalle du feeder et les seuils d'alerte, les
  données personnelles masquées ;
- les totaux — temps de fonctionnement, parts, coût d'électricité ;
- une ligne « hors ligne » quand le mineur ne répond pas : le graphique 24 h
  du board chute à 0, comme en local.

Et, pour tout le board, ses réglages : les actions à distance autorisées,
envoyées quand elles changent.

Un board a un nombre limité de mineurs, fixé par hashboard.
Au-delà, seuls les premiers mineurs activés, dans l'ordre de la
configuration, sont envoyés ; les autres restent relevés et surveillés en
local, et Configuration › Distant les nomme.

Les envois partent en arrière-plan : un hashboard lent ne retarde pas le
cycle, un échec est écrit dans les logs.
[Feeder › Envoi vers hashboard]({{ '/feeder.html#hashboard' | relative_url }}){: .link-page }

---

## 🕹️ Actions à distance
{: #actions-a-distance }

Sur un board privé, le détail d'un mineur garde ses boutons *Redémarrer* et
*Basculer*, pour les actions que tu autorises.

1. Ton board dépose la demande sur hashboard.
2. Ton dashboard la récupère dans la minute — il ne demande rien à
   hashboard tant qu'aucune action n'est autorisée.
3. Il vérifie qu'elle est toujours autorisée et que le mineur est bien l'un
   des tiens, la fait comme ses propres boutons et la note dans l'audit.
4. Le board affiche *Demande en cours*, puis *Demande récupérée* avec
   l'heure, boutons grisés. Une demande pas récupérée à temps expire sans
   être faite.

Une demande à la fois par mineur. Le résultat est dans l'audit, et dans un
mail si tu l'actives.
[Configuration › Distant]({{ '/configuration.html#distant' | relative_url }}){: .link-page }

---

## 🔒 Protection des données
{: #protection-des-donnees }

Ton wallet, tes pools et ton réseau local sont des données personnelles.
Avant chaque envoi, ton dashboard les masque : le champ reste, sa valeur
devient `xxxxxxxx` (`0` pour un port). hashboard ne reçoit donc jamais la
donnée, et le board ne l'affiche pas.

### Toujours masqué

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

### Masqué par défaut

À partager seulement si tu le choisis, dans Configuration › Distant :

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
      <td>l'utilisateur des pools principal et de secours</td>
    </tr>
    <tr>
      <td>Pools (adresse et port)</td>
      <td><code>xxxxxxxx</code>, port <code>0</code></td>
      <td>l'adresse et le port des pools principal et de secours</td>
    </tr>
    <tr>
      <td>Adresse IP des mineurs</td>
      <td>une adresse fictive tirée de la MAC : <code>aa:bb:cc:dd:ee:ff</code> devient <code>fd00::aabb:ccdd:eeff</code></td>
      <td>l'IP de chaque mineur sur ton réseau</td>
    </tr>
  </tbody>
</table>

L'adresse fictive ne dit rien de ton réseau : elle sert seulement au board à
reconnaître chaque mineur. Seul l'envoi est masqué : ton dashboard garde
tout en local — accueil, historique, sauvegardes, audit.

---

## 🧭 Dans le dashboard
{: #dans-le-dashboard }

Une fois l'envoi configuré, ton board apparaît dans le dashboard :

- Menu — sous *AxeOS · D#hashboard*, l'identifiant du board (clic pour
  l'ouvrir), public ou privé, et un lien vers ton compte hashboard.
- Accueil — sous le titre de la page, *Ouvrir ton board* et l'heure des
  dernières données reçues par hashboard.

{% include page_nav.html position="bottom" %}
