---
title: Mailer
nav_order: 6.8
group: Services
subnav:
  - title: Son rôle
    anchor: role
  - title: Les mails
    anchor: mails
  - title: Instance de dev
    anchor: dev
  - title: Textes des mails
    anchor: textes
  - title: Logs et arrêt
    anchor: logs
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#role" class="toc-card">
    <span class="toc-card-icon">🎯</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Son rôle</span>
      <span class="toc-card-sub">Un service à part, sur la machine</span>
    </span>
  </a>
  <a href="#mails" class="toc-card">
    <span class="toc-card-icon">✉️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Les mails</span>
      <span class="toc-card-sub">Lesquels, quand, demandés par qui</span>
    </span>
  </a>
  <a href="#dev" class="toc-card">
    <span class="toc-card-icon">🧪</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Instance de dev</span>
      <span class="toc-card-sub">Ce qu'elle n'envoie pas</span>
    </span>
  </a>
  <a href="#textes" class="toc-card">
    <span class="toc-card-icon">📝</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Textes des mails</span>
      <span class="toc-card-sub">Les modifier</span>
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

Le service qui envoie tous les mails du dashboard, par ton serveur SMTP.

## 🎯 Son rôle
{: #role }

Un service à part, à côté du feeder et de dashboard-api : un serveur SMTP
lent ou injoignable ne retarde ni les relevés ni l'interface.

- Son API — sur la machine elle-même (`127.0.0.1`, port `mailer.port`,
  8082 par défaut). Le feeder et dashboard-api lui passent les mails à
  envoyer.
- Un seul mailer — quand son port est déjà pris, il s'arrête aussitôt : deux
  mailers enverraient chaque rapport deux fois.
- Son état — dans *État plateforme*, en bas du menu, avec son dernier
  passage.

[Installation › Paramétrage]({{ '/installation.html#parametrage' | relative_url }}){: .link-page }

---

## ✉️ Les mails
{: #mails }

| Mail | Quand | Demandé par |
|---|---|---|
| Rapport d'audit | vers 1 h (UTC), quand la période choisie vient de se terminer ; un échec est réessayé chaque heure | le mailer lui-même, qui vérifie chaque minute |
| Alertes | si tu l'actives, à chaque relevé qui lève de nouvelles alertes, toutes dans un seul mail | le feeder |
| Action à distance | si tu l'actives, à chaque action demandée depuis ton board, faite ou non | dashboard-api |
| Mail de test et exemples | à la demande, depuis Configuration | dashboard-api |
{: .data-table }

L'objet de chaque mail commence par l'environnement qui l'a envoyé
(`global.env`, par exemple `[prod]`) : quand plusieurs installations écrivent
au même destinataire, chaque mail dit d'où il vient.

Les réglages de chaque mail sont dans Configuration, Notifications et
Distant.
[Configuration › Notifications]({{ '/configuration.html#notifications' | relative_url }}){: .link-page }

---

## 🧪 Instance de dev
{: #dev }

Quand `global.env` vaut `dev`, le rapport d'audit et les mails d'alertes
restent à l'installation réelle : une instance de développement aux mêmes
réglages SMTP ne les envoie pas une deuxième fois. Le mail de test, les
exemples et le mail des actions à distance partent, avec `[dev]` en tête
de leur objet.

---

## 📝 Textes des mails
{: #textes }

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
├── remote-action.fr.html
├── remote-action.en.html
├── remote-action.fr.txt
├── remote-action.en.txt
├── test-mail.fr.txt
└── test-mail.en.txt
```

Le mailer crée ceux qui manquent à son démarrage et ne touche jamais à un
fichier existant ; il les relit à chaque envoi, sans redémarrage. Pour
revenir au texte d'origine — ou récupérer celui d'une nouvelle version —,
supprime le fichier : il est recréé au prochain démarrage du mailer.

Le mail d'alertes, le rapport d'audit et le mail d'action à distance sont
en HTML : un en-tête avec le logo, une carte par alerte, par
événement ou pour l'action, un bouton vers la page Alertes ou Audit, et
un pied de page.

- Ce sont des modèles Go (`{{.Champ}}`, `{{range ...}}`...) dont la
  balise `<title>` est l'objet du mail ; leurs variables sont décrites en
  tête de fichier.
- S'ils ne passent pas, le modèle d'origine est utilisé et l'erreur est
  dans les logs du mailer.
- Une version texte est jointe pour les messageries sans HTML : générée pour
  le mail d'alertes et le rapport d'audit, tirée de `remote-action.*.txt`
  pour le mail d'action à distance.
- Le bouton n'apparaît que si l'adresse du dashboard est un nom, pas une
  IP, et l'adresse elle-même n'est jamais écrite dans le HTML : un lien
  vers une IP — même écrite en texte, que Gmail transforme en lien — fait
  classer le mail en spam.

Le mail de test est en texte, pour vérifier l'envoi sans mise en page :

```text
# Les lignes qui commencent par # sont des commentaires
Subject: AxeOS · D#hashboard — mail de test

Bonne nouvelle : AxeOS · D#hashboard sait envoyer des mails.

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

## 📜 Logs et arrêt
{: #logs }

- Logs — dans `{dataDir}/logs/mailer.log` (une ligne JSON par événement),
  ou dans la console quand `global.env` vaut `dev` : chaque mail envoyé ou
  en échec, avec le motif du serveur SMTP.
- Arrêt — proprement, sur `SIGINT` / `SIGTERM`.

{% include page_nav.html position="bottom" %}
