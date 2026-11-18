---
title: Configuration
nav_order: 5
group: Pages
subnav:
  - title: Mineurs
    anchor: mineurs
  - title: Électricité
    anchor: electricite
  - title: Notifications
    anchor: notifications
  - title: Distant (hashboard.live)
    anchor: distant
  - title: Système
    anchor: systeme
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#mineurs" class="toc-card">
    <span class="toc-card-icon">🖥️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Mineurs</span>
      <span class="toc-card-sub">Détection, réglages de chaque mineur, actions</span>
    </span>
  </a>
  <a href="#electricite" class="toc-card">
    <span class="toc-card-icon">⚡</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Électricité</span>
      <span class="toc-card-sub">Le tarif et tes autres appareils</span>
    </span>
  </a>
  <a href="#notifications" class="toc-card">
    <span class="toc-card-icon">✉️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Notifications</span>
      <span class="toc-card-sub">Serveur de mail, rapport d'audit, alertes</span>
    </span>
  </a>
  <a href="#distant" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Distant</span>
      <span class="toc-card-sub">L'envoi vers hashboard et tes données</span>
    </span>
  </a>
  <a href="#systeme" class="toc-card">
    <span class="toc-card-icon">⚙️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Système</span>
      <span class="toc-card-sub">Seuils d'alerte, pools, firmware</span>
    </span>
  </a>
</div>

Tous les réglages du dashboard, une section à la fois. Le menu des sections
résume chacune en une ligne, avec un point orange sur ce qui demande un coup
d'œil : un destinataire manquant, un mail en échec, un pool différent de
celui du mineur…

![Configuration]({{ '/assets/images/settings.png' | relative_url }}){: width="736" }

---

## 🖥️ Mineurs
{: #mineurs }

<div class="text-toc">
  <a href="#detection-automatique">Détection</a><span class="text-toc-sep">·</span><a href="#mineurs-configures">Mineurs configurés</a><span class="text-toc-sep">·</span><a href="#panneau-dun-mineur">Panneau d'un mineur</a><span class="text-toc-sep">·</span><a href="#actions">Actions</a>
</div>

### Détection automatique
{: #detection-automatique }

Cherche les mineurs AxeOS (bitaxe, nerdaxe) sur ton réseau local. Un mineur
qu'elle ne trouve pas (autre sous-réseau, pare-feu…) s'ajoute par son IP,
juste en dessous.

![Détection automatique]({{ '/assets/images/settings-scan-before.png' | relative_url }}){: width="533" }

Les mineurs trouvés s'affichent en dessous, prêts à être ajoutés.

![Résultats de la détection]({{ '/assets/images/settings-scan-results.png' | relative_url }}){: width="533" }

### Mineurs configurés
{: #mineurs-configures }

Tes mineurs : leur nom (et le hostname en dessous quand il diffère), IP,
modèle, seuils d'alerte et état — une horloge quand le mineur a des tâches
planifiées, *Désactivé* quand il l'est.

- ⚙ Configurer — ouvre son panneau de configuration, comme un clic sur sa
  ligne.
- 👁 Voir — ouvre son détail, le même que sur l'écran d'accueil.
- ⏸ Désactiver — après confirmation, le mineur n'est plus relevé : plus de
  relevés, d'alertes ni de tâches planifiées. Sa configuration et son
  historique restent ; ▶ le réactive.

![Mineurs configurés]({{ '/assets/images/settings-configured-miners.png' | relative_url }}){: width="533" }

### Panneau d'un mineur
{: #panneau-dun-mineur }

Un clic sur un mineur ouvre son panneau, à droite (plein écran sur
téléphone). Son menu, comme celui de Configuration, résume chaque section ;
chacune s'enregistre de son côté.

- Nom affiché — le nom du mineur partout dans le dashboard ; vide, c'est
  son hostname. Une détection relancée le garde.
- Pool — les pools principal et de secours (URL, port, utilisateur).
  *Inverser primaire et secours* les échange. Quand ils diffèrent de ceux
  du dernier relevé, un avertissement le dit, avec un point orange sur
  *Pool* dans le menu.

![Pool d'un mineur]({{ '/assets/images/settings-alias-pools.png' | relative_url }}){: width="627" }

- Seuils d'alerte — ceux de ce mineur seulement, pour un modèle qui tourne
  plus chaud ou plus ventilé. Un champ vide suit les seuils de tous les
  mineurs, affichés en grisé. La jauge montre aussi la valeur actuelle du
  mineur (le point).

![Seuils d'alerte d'un mineur]({{ '/assets/images/settings-miner-alert-thresholds.png' | relative_url }}){: width="627" }

- Planificateur — une bascule de pool ou un redémarrage à heure fixe, en
  cron. Chaque tâche affiche son action, quand elle tourne en clair, et son
  expression ; pendant la saisie, l'aperçu et les prochaines exécutions
  s'affichent sous le champ.

![Planificateur]({{ '/assets/images/settings-schedule.png' | relative_url }}){: width="627" }

### Actions
{: #actions }

Le bouton *Actions*, en haut de la liste, déplie ce qui agit sur tous tes
mineurs activés à la fois.

![Actions]({{ '/assets/images/settings-miners-actions.png' | relative_url }}){: width="533" }

- Basculer sur un pool — le menu liste les pools de tes mineurs, avec
  combien minent dessus sur combien l'ont. Après confirmation, chaque
  mineur qui l'a bascule dessus, qu'il soit en principal ou en secours,
  puis redémarre. Le résumé s'affiche en bas à gauche, et chaque bascule
  est notée dans l'audit, avec le pool quitté et le pool rejoint.
- Vérifier les pools — compare les deux pools de chaque mineur (URL, port,
  utilisateur) avec ceux du dashboard : ✅ quand ils sont les mêmes, ❌ sinon,
  avec ce qui diffère. Un mineur qui ne répond pas, ou dont la MAC n'est pas
  la bonne, est *non lu*. *Synchroniser* enregistre dans le dashboard les
  pools des mineurs à corriger.

![Vérification des pools]({{ '/assets/images/settings-miners-check.png' | relative_url }}){: width="465" }

---

## ⚡ Électricité
{: #electricite }

Le tarif (€/kWh) donne le coût par jour de l'accueil. Sous le tarif, tes
autres appareils (ventilateur, routeur…) et leur puissance, comptés en
plus des mineurs ; chacun s'enregistre dès qu'il est ajouté ou supprimé.

![Électricité]({{ '/assets/images/settings-electricity.png' | relative_url }}){: width="533" }

---

## ✉️ Notifications
{: #notifications }

Les mails : le serveur qui les envoie, à qui, le rapport d'audit et les
alertes.

![Notifications]({{ '/assets/images/settings-notifications.png' | relative_url }}){: width="533" }

- Serveur SMTP — hôte, port, sécurité (STARTTLS, TLS ou aucune, le port
  habituel proposé à chaque choix), identifiant et mot de passe s'il en
  faut, adresse d'expédition. Le mot de passe ne se réaffiche pas : laissé
  vide, l'ancien est gardé.
- Destinataires — ajoutés sous la liste, enregistrés aussitôt. En dessous,
  la langue des mails et l'adresse du dashboard, pour leurs liens.
- Mail de test — envoyé aux destinataires par le serveur enregistré. Une
  notification confirme l'envoi, ou donne le motif du serveur SMTP. Tant
  qu'aucun mail ne peut partir, un bandeau dit ce qui manque.
- Rapport d'audit — un résumé de l'audit, tous les jours, tous les 2
  jours, chaque semaine ou chaque mois, vers 1 h (UTC) ; tous les types ou
  ceux choisis, et rien quand il ne s'est rien passé si tu le veux. Un échec
  est réessayé chaque heure.
- Alertes — un mail à chaque relevé qui lève de nouvelles alertes, une seule
  fois par alerte, quand elle commence.

Sous le rapport et les alertes, la date du dernier envoi, ou du dernier
échec avec son motif ; *Envoyer un exemple* montre le mail sans attendre.
[Mailer]({{ '/mailer.html' | relative_url }}){: .link-page }

---

## ☁️ Distant (hashboard.live)
{: #distant }

L'envoi des statistiques de tes mineurs vers
[hashboard.live](https://hashboard.live){:target="_blank" rel="noopener noreferrer"},
pour les suivre de n'importe où, sans VPN.

![Distant (hashboard)]({{ '/assets/images/settings-remote.png' | relative_url }}){: width="533" }

- Ton board — une fois l'envoi configuré : son identifiant (clic pour
  l'ouvrir), public ou privé, les dernières données reçues, combien de tes
  mineurs il affiche sur sa limite, et un lien vers ton compte.
- Connexion — l'URL d'envoi et ta clé API hashboard. Une URL vide coupe
  l'envoi. Quand hashboard refuse la clé ou ne répond pas, une alerte le dit
  ici, avec un point orange sur *Distant*.
- Actions à distance — depuis ton board privé, redémarrer un mineur ou le
  basculer sur son autre pool, si tu l'autorises. Le dashboard récupère la
  demande dans la minute, la fait et la note dans l'audit. Un mail à chaque
  action, si tu l'actives.
- Protection de tes données — ton wallet, tes pools et les IP de tes
  mineurs sont masqués avant l'envoi. Un interrupteur par donnée pour la
  partager quand même.

Chaque changement est noté dans l'audit.
[Hashboard › Protection des données]({{ '/hashboard.html#protection-des-donnees' | relative_url }}){: .link-page }

---

## ⚙️ Système
{: #systeme }

<div class="text-toc">
  <a href="#seuils-dalerte">Seuils d'alerte</a><span class="text-toc-sep">·</span><a href="#dashboards-des-pools">Dashboards des pools</a><span class="text-toc-sep">·</span><a href="#depots-firmware">Dépôts firmware</a>
</div>

### Seuils d'alerte
{: #seuils-dalerte }

Les seuils de température et de ventilateur de tous tes mineurs — chacun
peut avoir les siens dans son panneau — et les marges, communes à tous.
Une alerte se termine sous son seuil moins sa marge. Vides, ce sont les
valeurs d'origine : 62 °C et 75 %, avec des marges de 2 °C et 5 %.

![Seuils d'alerte]({{ '/assets/images/settings-alert-thresholds.png' | relative_url }}){: width="533" }

La jauge montre les trois zones : vert jusqu'au retour à la normale, jaune
jusqu'au seuil (le trait), rouge au-delà.

### Dashboards des pools
{: #dashboards-des-pools }

Le lien qui rend un pool cliquable dans la liste et le détail des mineurs.
Les pools connus (Braiins, Atlas…) en ont déjà un ; pour un autre, ajoute
son hostname et l'URL de son dashboard, avec `{user}` à la place du compte
de l'utilisateur stratum. *Voir les pools intégrés* déplie ceux d'origine.

![Dashboards des pools]({{ '/assets/images/settings-pools.png' | relative_url }}){: width="533" }

### Dépôts firmware
{: #depots-firmware }

Où le dashboard cherche la dernière version du firmware de chaque modèle,
une release GitHub — fixés dans l'application.

![Dépôts firmware]({{ '/assets/images/settings-firmware.png' | relative_url }}){: width="533" }

{% include page_nav.html position="bottom" %}
