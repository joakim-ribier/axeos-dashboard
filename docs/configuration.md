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
demande un coup d'œil (aucun destinataire, rapport d'audit en échec, pool
différent de la configuration...).

![Configuration]({{ '/assets/images/settings.png' | relative_url }})

---

## 🖥️ Mineurs
{: #mineurs }

### Détection automatique
{: #detection-automatique }

Scanne le réseau local à la recherche de mineurs AxeOS (bitaxe,
nerdaxe). Un mineur non trouvé (autre sous-réseau, pare-feu...) peut être
ajouté directement par IP, juste à côté.

![Détection automatique]({{ '/assets/images/settings-scan-before.png' | relative_url }})

Les mineurs trouvés s'affichent en dessous, prêts à être ajoutés à la
configuration.

![Résultats de la détection]({{ '/assets/images/settings-scan-results.png' | relative_url }})

### Mineurs configurés
{: #mineurs-configures }

La liste des mineurs déjà configurés, avec leur IP, MAC, modèle et état
— activation/désactivation en un clic, par mineur ou tous à la fois.

![Mineurs configurés]({{ '/assets/images/settings-configured-miners.png' | relative_url }})

#### Nom et pools

Cliquer sur un mineur déplie son éditeur : nom affiché, et pool primaire
/ secours (URL, port, utilisateur).

![Nom et pools]({{ '/assets/images/settings-alias-pools.png' | relative_url }})

#### Planificateur

Programme un changement de pool ou un redémarrage selon un planning cron.

![Planificateur]({{ '/assets/images/settings-schedule.png' | relative_url }})

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

L'envoi de mails : le serveur qui les envoie, à qui, et le rapport
d'audit. Tous les mails partent du **mailer**, un service à part qui
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

### Mail de test

Envoie un mail aux destinataires avec le serveur **enregistré**, pour
vérifier que tout fonctionne — le mailer compris. Une petite notification
confirme l'envoi ; en cas d'échec, elle donne le motif du serveur SMTP,
avec un bouton pour le copier.

### Textes des mails

{% raw %}
L'objet et le texte de chaque mail sont dans des fichiers modifiables,
dans le dossier `mail-templates/` à côté de `dashboard.yml` — un fichier
par mail et par langue :

```text
mail-templates/
├── audit-report.fr.txt
├── audit-report.en.txt
├── test-mail.fr.txt
└── test-mail.en.txt
```

Le mailer crée ceux qui manquent à son démarrage et ne touche jamais à un
fichier existant ; il les relit à chaque envoi, sans redémarrage.

```text
# Les lignes qui commencent par # sont des commentaires
Subject: AxeOS Dashboard — {{title}} : {{count}}

{{title}} — {{count}}

{{events}}

Voir dans le dashboard : {{link}}
```

- La ligne `Subject:` est l'objet du mail ; après la ligne vide, le texte.
- Chaque `{{variable}}` est remplacée à l'envoi — la liste des variables
  de chaque mail est en commentaire en tête de son fichier (`{{date}}`,
  `{{events}}`, `{{link}}`...).
- Une ligne dont la variable est vide disparaît (le lien, sans adresse du
  dashboard).
- Pour revenir au texte d'origine, supprimer le fichier : il est recréé
  au prochain démarrage du mailer.
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

### Dashboards des pools

Certains pools ont déjà un lien cliquable intégré (Braiins, Atlas...).
Pour un pool non reconnu nativement par l'app, on peut ajouter
soi-même la correspondance entre son hostname et l'URL de son
dashboard, avec `{user}` comme placeholder pour la partie compte de
l'utilisateur stratum — le lien devient alors cliquable dans la liste et
le détail des mineurs qui utilisent ce pool.

![Dashboards des pools]({{ '/assets/images/settings-pools.png' | relative_url }})

### Dépôts firmware

Où le dashboard vérifie la dernière version du firmware de chaque modèle
(une release GitHub) — intégrés à l'application, affichés en lecture
seule.

![Dépôts firmware]({{ '/assets/images/settings-firmware.png' | relative_url }})
