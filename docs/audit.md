---
title: Audit
nav_order: 6.5
group: Pages
subnav:
  - title: La page
    anchor: page
  - title: Événements enregistrés
    anchor: evenements
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#page" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-text">
      <span class="toc-card-title">La page</span>
      <span class="toc-card-sub">Les filtres et les événements d'un jour</span>
    </span>
  </a>
  <a href="#evenements" class="toc-card">
    <span class="toc-card-icon">🗂️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Événements enregistrés</span>
      <span class="toc-card-sub">Chaque type, d'où il vient</span>
    </span>
  </a>
</div>

Tout ce qui agit sur un mineur ou sur la configuration, sort des données ou
scanne le réseau — depuis le dashboard, depuis ton board, ou par
l'application elle-même.

## 📋 La page
{: #page }

![Page Audit]({{ '/assets/images/audit.png' | relative_url }}){: width="723" }

1. Mineur — un mineur, ou tous.
2. Type — un type d'événement, ou tous.
3. Jour — un jour, de minuit à minuit UTC ; vide, les dernières 24 heures.
4. Exporter — toutes les entrées de la période et des filtres, dans un
   fichier JSON.
5. Par l'application — ici le planificateur, avec l'expression cron qui a
   déclenché l'action.
6. Copier — l'entrée complète, en JSON.
7. Depuis le dashboard — avec l'IP et le navigateur de l'appareil (le
   détail au survol).
8. La sauvegarde de chaque nuit — avec le mois mis à jour.

Un point vert pour une réussite, rouge pour un échec, avec le code et le
message d'erreur. Les heures sont en UTC, comme dans les Sauvegardes et le
rapport d'audit par mail : un même événement a la même heure partout.

---

## 🗂️ Événements enregistrés
{: #evenements }

Chaque entrée dit quoi (le type), quand, qui (l'IP et le navigateur, ton
board, ou la partie de l'application qui a agi), sur quel mineur, et le
résultat. Une action qui échoue est notée aussi.

### ⚙️ Actions sur les mineurs

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Libellé</th>
      <th>D'où</th>
      <th>Contenu</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>restart</code></td>
      <td>Redémarrage</td>
      <td>le détail d'un mineur, une tâche du planificateur, ou ton board</td>
      <td>le mineur redémarré</td>
    </tr>
    <tr>
      <td><code>switch_primary</code></td>
      <td>Bascule vers le pool principal</td>
      <td>le détail d'un mineur, une tâche du planificateur, ou ton board</td>
      <td>le mineur, le pool quitté et le pool rejoint</td>
    </tr>
    <tr>
      <td><code>switch_fallback</code></td>
      <td>Bascule vers le pool de secours</td>
      <td>idem</td>
      <td>idem</td>
    </tr>
    <tr>
      <td><code>switch_pool</code></td>
      <td>Bascule vers un pool</td>
      <td>Configuration › Mineurs › Actions › Basculer sur un pool, une entrée par mineur basculé</td>
      <td>le mineur, le pool quitté et le pool rejoint ; tous les mineurs quand aucun n'avait à basculer</td>
    </tr>
  </tbody>
</table>

### 🛠️ Configuration

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Libellé</th>
      <th>D'où</th>
      <th>Contenu</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>save_miners</code></td>
      <td>Enregistrement des mineurs</td>
      <td>Configuration : la détection, l'activation, le nom, les pools, le planificateur</td>
      <td>pour chaque mineur, ce qui a changé hors changements sensibles : nom, hostname, modèle (avant → après)</td>
    </tr>
    <tr>
      <td><code>save_settings</code></td>
      <td>Enregistrement des paramètres</td>
      <td>Configuration : électricité, dashboards des pools, distant</td>
      <td>ce qui a changé hors changements sensibles : le tarif (avant → après), les appareils et les dashboards de pool ajoutés ou supprimés</td>
    </tr>
  </tbody>
</table>

### 📤 Données et réseau

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Libellé</th>
      <th>D'où</th>
      <th>Contenu</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>export_audit</code></td>
      <td>Export de l'audit</td>
      <td>Audit › Exporter</td>
      <td>la période et les filtres exportés</td>
    </tr>
    <tr>
      <td><code>download_backups</code></td>
      <td>Téléchargement de sauvegardes</td>
      <td>Sauvegardes › Télécharger</td>
      <td>les mois téléchargés</td>
    </tr>
    <tr>
      <td><code>discover</code></td>
      <td>Détection réseau</td>
      <td>Configuration › Détection automatique, ou ajout par IP</td>
      <td>la plage scannée ou l'IP sondée</td>
    </tr>
    <tr>
      <td><code>backup</code></td>
      <td>Sauvegarde mise à jour</td>
      <td>chaque nuit, par l'application</td>
      <td>les mois dont l'archive a été mise à jour</td>
    </tr>
    <tr>
      <td><code>audit_report</code></td>
      <td>Rapport d'audit envoyé</td>
      <td>la nuit, par le mailer, à la fréquence choisie</td>
      <td>la période et les destinataires ; l'erreur en cas d'échec</td>
    </tr>
    <tr>
      <td><code>alert_mail</code></td>
      <td>Mail d'alertes non envoyé</td>
      <td>par le mailer, quand le mail des nouvelles alertes n'a pas pu partir</td>
      <td>le relevé concerné et l'erreur</td>
    </tr>
  </tbody>
</table>

### 🔐 Changements sensibles

Un enregistrement qui contient un changement sensible le note dans une
entrée à lui, à la place de <code>save_miners</code> ou
<code>save_settings</code>, avec avant → après : on le retrouve par son
type. Un seul enregistrement peut en produire plusieurs, le pool et le
planificateur d'un mineur par exemple.

<table class="data-table">
  <thead>
    <tr>
      <th>Type</th>
      <th>Libellé</th>
      <th>Quand</th>
      <th>Détail</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>miner_pool</code></td>
      <td>Pool du mineur modifié</td>
      <td>l'URL, le port ou l'utilisateur d'un pool change</td>
      <td>chaque champ — ex. <em>Utilisateur de secours : bc1q…abc.w1 → bc1q…xyz.w1</em></td>
    </tr>
    <tr>
      <td><code>miner_schedule</code></td>
      <td>Planification modifiée</td>
      <td>une tâche planifiée est ajoutée ou supprimée</td>
      <td>chaque tâche, en clair — ex. <em>Tâche ajoutée : Redémarrage · À 00:00, uniquement le mercredi (0 0 0 * * WED)</em></td>
    </tr>
    <tr>
      <td><code>miner_identity</code></td>
      <td>IP du mineur modifiée</td>
      <td>l'IP d'un mineur change (il est reconnu par sa MAC)</td>
      <td>l'ancienne et la nouvelle IP</td>
    </tr>
    <tr>
      <td><code>miner_disabled</code> / <code>miner_enabled</code></td>
      <td>Mineur désactivé / activé</td>
      <td>un mineur est désactivé ou réactivé</td>
      <td>—</td>
    </tr>
    <tr>
      <td><code>miner_added</code></td>
      <td>Mineur ajouté</td>
      <td>un mineur entre dans la configuration</td>
      <td>ses pools et ses tâches planifiées</td>
    </tr>
    <tr>
      <td><code>remote_push</code></td>
      <td>Accès distant modifié</td>
      <td>l'URL d'envoi, la clé API, une action à distance ou la protection des données change</td>
      <td>chaque réglage avant et après ; la clé API est seulement « modifiée »</td>
    </tr>
    <tr>
      <td><code>mail_settings</code></td>
      <td>Notifications modifiées</td>
      <td>le serveur SMTP ou les destinataires changent</td>
      <td>chaque champ avant et après, les destinataires ajoutés ou retirés ; le mot de passe est seulement « modifié »</td>
    </tr>
  </tbody>
</table>

Un enregistrement qui ne change rien n'est pas noté.

{% include page_nav.html position="bottom" %}
