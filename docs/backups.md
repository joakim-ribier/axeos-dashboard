---
title: Sauvegardes
nav_order: 6
group: Pages
subnav:
  - title: Contenu d'une archive
    anchor: contenu
  - title: Restaurer
    anchor: restaurer
  - title: Masquer la page
    anchor: masquer
---

# Sauvegardes

<div class="toc-grid">
  <a href="#contenu" class="toc-card">
    <span class="toc-card-icon">📦</span>
    <span class="toc-card-title">Contenu d'une archive</span>
  </a>
  <a href="#restaurer" class="toc-card">
    <span class="toc-card-icon">♻️</span>
    <span class="toc-card-title">Restaurer</span>
  </a>
  <a href="#masquer" class="toc-card">
    <span class="toc-card-icon">🙈</span>
    <span class="toc-card-title">Masquer la page</span>
  </a>
</div>

L'historique des mineurs archivé automatiquement par le feeder, une
archive zip par mois. Accessible depuis le menu, juste sous
Configuration.

![Page Sauvegardes]({{ '/assets/images/backups.png' | relative_url }})

Chaque nuit, la journée de la veille est ajoutée à l'archive de son mois,
dans l'heure qui suit minuit UTC (1h ou 2h du matin, heure de Paris). Le
mois en cours est marqué **en cours** et contient donc tout jusqu'à la
veille. Le 1er du mois suivant, son archive est complète et devient
définitive : elle ne sera plus jamais modifiée, et son checksum (MD5)
s'affiche dans le tableau.

Au premier démarrage, tout l'historique déjà présent sur le disque est
archivé, mois par mois. Si le feeder a été arrêté quelques jours, les
journées manquantes sont rattrapées à son redémarrage.

- **Un mois** — l'icône en bout de ligne télécharge son archive.
- **Plusieurs mois** — cochez-les, puis **Télécharger** : un seul zip qui
  les regroupe, avec leur taille totale approximative affichée à côté du
  bouton. La sélection est conservée d'une année à l'autre.
- **Par année** — le pied du tableau affiche une année à la fois,
  l'année en cours par défaut ; les flèches passent aux années
  précédentes.

---

## 📦 Contenu d'une archive
{: #contenu }

Les fichiers `.jsonl` de chaque mineur pour le mois, rangés comme dans le
dossier de données :

```
axeos-backup-2026-09.zip
└── data/bitaxes/
    ├── aabbccddee01/
    │   ├── 2026-09-01.jsonl
    │   ├── 2026-09-02.jsonl
    │   └── ...
    └── aabbccddee02/
        └── ...
```

Un téléchargement de plusieurs mois a exactement la même forme, avec les
journées de tous les mois sélectionnés.

Les archives sont stockées dans `{dataDir}/data/backups/`
(`./storage/data/backups/` avec Docker), avec `checksums.md5`, le MD5 de
chaque archive définitive. Pour les vérifier depuis ce dossier :

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ md5sum -c checksums.md5</span></pre>
</div>

---

## ♻️ Restaurer
{: #restaurer }

Décompressez l'archive dans le `dataDir` du dashboard — `-n` garde les
fichiers déjà présents plutôt que de les écraser :

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ unzip -n axeos-backup-2026-09.zip -d ./storage</span></pre>
</div>

Puis reconstruisez les totaux avec
[rebuild-totals]({{ '/rebuild-totals.html#rebuild-totals' | relative_url }}).

---

## 🙈 Masquer la page
{: #masquer }

La page et son entrée dans le menu se masquent depuis `dashboard.yml`
(redémarrage du dashboard nécessaire). Le feeder continue d'archiver
chaque nuit.

```yaml
ui:
  page:
    backups: hidden   # enabled (par défaut) | hidden
```
