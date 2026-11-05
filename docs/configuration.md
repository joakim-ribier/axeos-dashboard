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

# Configuration

<div class="toc-grid">
  <a href="#mineurs" class="toc-card">
    <span class="toc-card-icon">🖥️</span>
    <span class="toc-card-title">Mineurs</span>
  </a>
  <a href="#electricite" class="toc-card">
    <span class="toc-card-icon">⚡</span>
    <span class="toc-card-title">Électricité</span>
  </a>
  <a href="#notifications" class="toc-card">
    <span class="toc-card-icon">✉️</span>
    <span class="toc-card-title">Notifications</span>
  </a>
  <a href="#distant" class="toc-card">
    <span class="toc-card-icon">☁️</span>
    <span class="toc-card-title">Distant (hashboard.live)</span>
  </a>
  <a href="#systeme" class="toc-card">
    <span class="toc-card-icon">⚙️</span>
    <span class="toc-card-title">Système</span>
  </a>
</div>

Une seule page, une section à la fois : chaque section se choisit dans un
menu qui la résume en une ligne, et signale d'un point orange ce qui
demande un coup d'œil (aucun destinataire, rapport d'audit ou mail
d'alertes en échec, pool différent de la configuration...).

![Configuration]({{ '/assets/images/settings.png' | relative_url }})

---

## 🖥️ Mineurs
{: #mineurs }

### Détection automatique
{: #detection-automatique }

Scanne le réseau local à la recherche de mineurs AxeOS (bitaxe,
nerdaxe). Un mineur non trouvé (autre sous-réseau, pare-feu...) peut être
ajouté directement par IP, juste en dessous.

![Détection automatique]({{ '/assets/images/settings-scan-before.png' | relative_url }})

Les mineurs trouvés s'affichent en dessous, prêts à être ajoutés à la
configuration.

![Résultats de la détection]({{ '/assets/images/settings-scan-results.png' | relative_url }})

### Mineurs configurés
{: #mineurs-configures }

La liste des mineurs déjà configurés : nom (l'alias, et le hostname en
dessous quand il diffère), IP, modèle, seuils d'alerte et état — une
horloge pour un mineur qui a des tâches planifiées, **Désactivé** pour un
mineur désactivé. Sur téléphone, chaque mineur tient sur quelques lignes
courtes au lieu d'un tableau.

Les actions de chaque mineur :

- ⚙ **Configurer** ouvre son panneau de configuration, comme un clic sur
  sa ligne (voir [Panneau d'un mineur](#panneau-dun-mineur)).
- 👁 **Voir** ouvre son panneau de détail, le même que sur le
  [tableau de bord]({{ '/dashboard.html' | relative_url }}).
- ⏸ **Désactiver**, après confirmation : le mineur disparaît du tableau
  de bord et n'est plus interrogé — plus de relevés, d'alertes ni de
  tâches planifiées. Sa configuration et son historique sont conservés ;
  ▶ le réactive.

Le bouton **Actions** déplie ce qui agit sur tous les mineurs à la fois
(voir [Actions](#actions)).

![Mineurs configurés]({{ '/assets/images/settings-configured-miners.png' | relative_url }})

### Panneau d'un mineur
{: #panneau-dun-mineur }

Un clic sur un mineur ouvre son panneau de configuration, à droite (en
plein écran sur téléphone). Un menu, le même que celui de Configuration,
résume chaque section — nom affiché, pool, seuils d'alerte,
planificateur — et la section choisie s'affiche à côté, avec son propre
bouton **Enregistrer**.

#### Nom affiché

Le nom sous lequel le mineur apparaît partout dans le dashboard ; vide,
c'est son hostname. Une détection relancée ne le change jamais.

#### Pool

Les pools primaire et de secours du mineur (URL, port, utilisateur).
**Inverser primaire et secours** échange les deux avant d'enregistrer.
Quand ces pools diffèrent de ceux du dernier relevé du feeder, un
avertissement le signale au-dessus, avec l'heure de ce relevé, et un
point orange sur l'entrée **Pool** du menu.

![Pool d'un mineur]({{ '/assets/images/settings-alias-pools.png' | relative_url }})

#### Seuils d'alerte

Les seuils de température et de ventilateur de ce mineur seulement —
utile pour un modèle qui tourne naturellement plus chaud ou avec un
ventilateur plus haut. Un champ vide suit les seuils de tous les mineurs
(voir [Système](#systeme)), affichés en grisé. Sous chaque seuil, la même
jauge que dans Système, avec en plus la valeur actuelle du mineur (le
point) : verte jusqu'au retour à la normale, jaune jusqu'au seuil, rouge
au-delà.

![Seuils d'alerte d'un mineur]({{ '/assets/images/settings-miner-alert-thresholds.png' | relative_url }})

#### Planificateur

Programme un changement de pool ou un redémarrage selon un planning cron.
Chaque tâche affiche son action, quand elle s'exécute en clair et son
expression cron ; pendant la saisie d'une nouvelle, l'aperçu en clair et
les prochaines exécutions s'affichent sous le champ.

![Planificateur]({{ '/assets/images/settings-schedule.png' | relative_url }})

### Actions
{: #actions }

Le bouton **Actions**, en haut de la liste, déplie les actions qui
portent sur tous les mineurs activés à la fois.

![Actions]({{ '/assets/images/settings-miners-actions.png' | relative_url }})

#### Basculer sur un pool

Le menu liste les pools que les mineurs ont en ce moment, avec pour
chacun le nombre de mineurs qui minent dessus sur le nombre qui l'ont.
Après confirmation, chaque mineur qui a le pool choisi bascule dessus,
quel que soit le slot où il l'a (primaire ou secours), puis redémarre ;
ceux déjà dessus ou qui ne l'ont pas restent tels quels. Le résumé
s'affiche en bas à gauche, et chaque mineur basculé a son entrée dans
l'[audit]({{ '/audit.html' | relative_url }}), avec le pool quitté et
le pool rejoint.

#### Vérifier les pools

Interroge chaque mineur et compare ses deux pools (URL, port,
utilisateur) avec ceux enregistrés dans le dashboard. Le rapport donne,
pour chaque mineur, son nom et son alias, son IP et sa MAC, puis son
pool primaire et son pool de secours tels que le mineur les a : ✅
quand le dashboard a les mêmes, ❌ sinon, avec chaque champ qui diffère.
Un mineur qui ne répond pas, ou dont la MAC n'est pas celle enregistrée,
est **non lu**. **Synchroniser** enregistre dans le dashboard les pools
des mineurs à corriger.

![Vérification des pools]({{ '/assets/images/settings-miners-check.png' | relative_url }})

---

## ⚡ Électricité
{: #electricite }

Le tarif électrique (€/kWh) sert à estimer le coût journalier affiché
sur l'accueil.

Sous le tarif, **Autres appareils** permet de déclarer les équipements
qui tournent avec les mineurs (ventilateur, routeur...) avec leur
puissance en watts, considérée comme constante, pour estimer le coût
journalier de l'installation complète. Un appareil est enregistré dès
qu'il est ajouté ou supprimé.

![Électricité]({{ '/assets/images/settings-electricity.png' | relative_url }})

---

## ✉️ Notifications
{: #notifications }

L'envoi de mails : le serveur qui les envoie, à qui, le rapport d'audit
et les alertes. Tous les mails partent du **mailer**, un service à part qui
tourne à côté du feeder (voir [Installation]({{ '/installation.html#parametrage' | relative_url }})).

![Notifications]({{ '/assets/images/settings-notifications.png' | relative_url }})

### Serveur SMTP

Le serveur par lequel partent les mails : hôte, port, sécurité
(**STARTTLS**, **TLS** ou **aucune** — le port usuel est proposé à chaque
changement), identifiant et mot de passe s'il en faut, et l'adresse
d'expédition.

Le mot de passe n'est jamais réaffiché : un champ vide à l'enregistrement
garde celui déjà enregistré.

### Destinataires

Les adresses qui reçoivent les mails, ajoutées sous la liste et
enregistrées aussitôt.

Juste en dessous, la **langue des mails** (français ou anglais) et
l'**adresse du dashboard**, utilisée pour les liens dans les mails —
préremplie avec l'adresse à laquelle la page est ouverte.

En dessous, **Envoyer un mail de test** envoie un mail aux destinataires
avec le serveur **enregistré**, pour vérifier que tout fonctionne — le
mailer compris. Une petite notification confirme l'envoi ; en cas
d'échec, elle donne le motif du serveur SMTP, avec un bouton pour le
copier. Tant qu'aucun mail ne peut partir, les boutons d'envoi sont grisés
et un bandeau en haut de la section dit ce qui manque.

### Rapport d'audit

Un mail qui résume l'[audit]({{ '/audit.html' | relative_url }}) depuis le
précédent, groupé par type :

- **Fréquence** — tous les jours, tous les 2 jours, chaque semaine (du
  lundi au dimanche) ou chaque mois ; envoyé vers 1 h (UTC), la période
  couverte venant de se terminer.
- **Types** — tous par défaut, ou seulement ceux choisis.
- **Ne rien envoyer si rien ne s'est passé** — saute une période vide.

Sous le réglage, la date du dernier envoi, ou du dernier échec avec son
motif — un échec est réessayé chaque heure. Chaque rapport envoyé, ou en
échec, apparaît aussi dans l'audit.

**Envoyer un exemple** envoie aux destinataires un rapport d'audit
fictif sur la veille, quels que soient les types choisis, pour voir à quoi
il ressemble sans attendre la nuit.

### Alertes

**Envoyer un mail à chaque nouvelle alerte** : à chaque relevé du feeder
qui lève de nouvelles [alertes]({{ '/alerts.html' | relative_url }}), un
mail les regroupe toutes — une seule fois par alerte, au moment où elle
commence, et rien quand elle se termine. Une mise à jour firmware
disponible part donc une fois, pas chaque jour. Le réglage s'enregistre
dès qu'on le bascule ; les alertes levées avant ne partent pas.

**Envoyer un exemple** envoie aux destinataires un mail d'alertes avec
des alertes fictives, pour voir à quoi il ressemble.

Sous le réglage, la date du dernier mail envoyé, ou du dernier échec avec
son motif — un échec apparaît aussi dans l'audit (un mail envoyé n'y
apparaît pas). Activer ou couper le réglage
apparaît aussi dans l'audit.

### Textes des mails

{% raw %}
L'objet et le texte de chaque mail sont dans des fichiers modifiables,
dans le dossier `mail-templates/` à côté de `dashboard.yml` — un fichier
par mail et par langue :

```text
mail-templates/
├── alert.fr.html
├── alert.en.html
├── audit-report.fr.html
├── audit-report.en.html
├── test-mail.fr.txt
└── test-mail.en.txt
```

Le mailer crée ceux qui manquent à son démarrage et ne touche jamais à un
fichier existant ; il les relit à chaque envoi, sans redémarrage. Pour
revenir au texte d'origine, supprimer le fichier : il est recréé au
prochain démarrage du mailer.

**Le mail d'alertes et le rapport d'audit sont en HTML** : un en-tête avec
le logo, une carte par alerte ou par événement, un bouton vers la page
Alertes ou Audit, et un pied de page.

- Ce sont des modèles Go (`{{.Champ}}`, `{{range ...}}`...) dont la
  balise `<title>` est l'objet du mail ; leurs variables sont décrites en
  tête de fichier.
- S'ils ne passent pas, le modèle d'origine est utilisé et l'erreur est
  dans les logs du mailer.
- Une version texte est jointe automatiquement pour les messageries qui
  n'affichent pas le HTML.
- Le bouton n'apparaît que si l'adresse du dashboard est un nom, pas une
  IP, et l'adresse elle-même n'est jamais écrite dans le HTML : un lien
  vers une IP — même écrite en texte, que Gmail transforme en lien — fait
  classer le mail en spam.

**Le mail de test est en texte**, pour vérifier l'envoi sans mise en page :

```text
# Les lignes qui commencent par # sont des commentaires
Subject: AxeOS Dashboard — mail de test

Bonne nouvelle : AxeOS Dashboard sait envoyer des mails.

  • Serveur SMTP : {{server}} ({{security}})
  • Destinataires : {{to}}

Dashboard : {{dashboardURL}}
```

- La ligne `Subject:` est l'objet du mail ; après la ligne vide, le texte.
- Chaque `{{variable}}` est remplacée à l'envoi — la liste est en
  commentaire en tête du fichier.
- Une ligne dont la variable est vide disparaît (l'adresse, sans adresse
  du dashboard).
{% endraw %}

---

## ☁️ Distant (hashboard.live)
{: #distant }

L'envoi des stats de vos mineurs vers [hashboard.live](https://hashboard.live),
pour suivre votre flotte depuis n'importe où, sans VPN.

![Distant (hashboard)]({{ '/assets/images/settings-remote.png' | relative_url }})

- **Ton board** — une fois l'envoi configuré : l'identifiant du board
  (clic pour l'ouvrir), s'il est public ou privé, l'heure des dernières
  données reçues par hashboard, et un lien vers votre compte.
- **Connexion** — l'URL de push et votre clé API hashboard, puis
  **Enregistrer**. Une URL vide coupe l'envoi.
- **Actions à distance** — depuis votre board privé, vous pouvez
  redémarrer un mineur ou le basculer sur son autre pool. Un interrupteur
  pour le redémarrage, un pour la bascule : seules les actions autorisées
  apparaissent sur le board. Le dashboard récupère la demande dans la
  minute, la fait, et l'inscrit dans l'audit (service *Board distant*, avec
  l'IP d'où elle a été demandée). Un troisième interrupteur envoie un mail à
  chaque action, par le serveur SMTP des Notifications ; **Tester** envoie un
  exemple de ce mail, une fois le serveur et un destinataire renseignés.
- **Protection de tes données** — votre wallet, vos pools et l'IP de vos
  mineurs sont offusqués avant l'envoi : hashboard ne les reçoit pas. Un
  interrupteur par donnée pour la partager malgré tout ; chacun
  s'enregistre dès le clic et affiche son état : *Privé — jamais envoyé*,
  *Masqué — adresse fictive* (l'IP), ou *Partagé avec hashboard*.

Chaque modification est enregistrée dans l'audit, sous *Accès distant
modifié*.

[Voir la protection des données →]({{ '/hashboard.html#protection-des-donnees' | relative_url }}){: .btn .btn-primary }

---

## ⚙️ Système
{: #systeme }

### Seuils d'alerte

Une alerte se déclenche quand la température de la puce ou la vitesse du
ventilateur dépasse son seuil, et se termine une fois la valeur
redescendue sous le seuil moins sa **marge de retour** : une valeur qui
oscille autour du seuil ne déclenche pas une alerte à chaque relevé. Les
seuils réglés ici valent pour tous les mineurs — chacun peut avoir les
siens dans son [panneau](#panneau-dun-mineur) — et les marges de retour
pour tous. Vides, ce sont les valeurs d'origine : 62 °C et 75 %, avec des
marges de 2 °C et 5 %.

Sous chaque mesure, une jauge montre les trois zones — verte jusqu'au
retour à la normale, jaune jusqu'au seuil (marqué d'un trait), rouge
au-delà — et la valeur de retour à la normale.

![Seuils d'alerte]({{ '/assets/images/settings-alert-thresholds.png' | relative_url }})

### Dashboards des pools

Certains pools ont déjà un lien cliquable intégré (Braiins, Atlas...).
Pour un pool non reconnu nativement par l'app, on peut ajouter
soi-même la correspondance entre son hostname et l'URL de son
dashboard, avec `{user}` comme placeholder pour la partie compte de
l'utilisateur stratum — le lien devient alors cliquable dans la liste et
le détail des mineurs qui utilisent ce pool.

Seuls les pools ajoutés à la main sont affichés d'emblée : **Voir les
pools intégrés** déplie les autres. Une URL trop longue est coupée, et
s'affiche en entier au survol (ou au toucher sur téléphone).

![Dashboards des pools]({{ '/assets/images/settings-pools.png' | relative_url }})

### Dépôts firmware

Où le dashboard vérifie la dernière version du firmware de chaque modèle
(une release GitHub) — intégrés à l'application, affichés en lecture
seule.

![Dépôts firmware]({{ '/assets/images/settings-firmware.png' | relative_url }})
