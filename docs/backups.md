---
title: Sauvegardes
nav_order: 6
group: Pages
subnav:
  - title: La page
    anchor: page
  - title: Restaurer
    anchor: restaurer
---

{% include page_nav.html position="top" %}

<div class="toc-grid">
  <a href="#page" class="toc-card">
    <span class="toc-card-icon">📋</span>
    <span class="toc-card-text">
      <span class="toc-card-title">La page</span>
      <span class="toc-card-sub">Un zip par mois, à télécharger</span>
    </span>
  </a>
  <a href="#restaurer" class="toc-card">
    <span class="toc-card-icon">♻️</span>
    <span class="toc-card-text">
      <span class="toc-card-title">Restaurer</span>
      <span class="toc-card-sub">Remettre un mois sur le disque</span>
    </span>
  </a>
</div>

L'historique de tes mineurs, archivé automatiquement : un zip par mois.

## 📋 La page
{: #page }

![Page Sauvegardes]({{ '/assets/images/backups.png' | relative_url }}){: width="701" }

1. Télécharger — les mois cochés, dans un seul zip ; leur taille totale
   s'affiche à côté.
2. Tout cocher — les mois de l'année affichée. La sélection reste d'une
   année à l'autre.
3. En cours — le mois en cours, complété chaque nuit avec la veille.
4. Un mois — télécharge son archive.
5. Année — une année à la fois, l'année en cours par défaut.

Chaque nuit, dans l'heure qui suit minuit UTC, la veille rejoint l'archive
de son mois. Le 1er du mois suivant, l'archive est complète : elle ne change
plus, et son checksum (MD5) s'affiche. Au premier démarrage, tout
l'historique déjà sur le disque est archivé ; après un arrêt du feeder, les
jours manquants sont rattrapés.

---

## ♻️ Restaurer
{: #restaurer }

Une archive reprend les dossiers de tes mineurs, un fichier par jour.
Décompresse-la dans le dossier de données ; `-n` garde les fichiers déjà
présents :

<div class="terminal-card">
  <div class="terminal-card-header">
    <span class="terminal-card-icon">&gt;_</span>
    <span class="terminal-card-title">Terminal</span>
  </div>
  <pre class="terminal-card-body"><span class="term-command">$ unzip -n axeos-backup-2026-09.zip -d ./storage</span></pre>
</div>

Puis reconstruis les totaux.
[Scripts › rebuild-totals]({{ '/rebuild-totals.html#rebuild-totals' | relative_url }}){: .link-page }

{% include page_nav.html position="bottom" %}
