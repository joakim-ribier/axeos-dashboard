# Pack d'icônes axeos-dashboard / hashboard

Icône « Hash Chip ₿ » : une puce ASIC dont le `#` de hashboard se referme en ₿, avec le pouls du hashrate en guise de taille.

Ce dossier est la source de toutes les icônes : l'app, le site de doc et hashboard.live en utilisent des copies. Pour changer une icône, la changer ici, puis recopier le fichier aux endroits listés plus bas.

## Fichiers

| Fichier | Usage |
|---|---|
| `icon.svg` | SVG maître (512), version détaillée avec lueur et voyant « online » |
| `favicon.svg` | Favicon SVG simplifié pour 16–48 px (traits épaissis, sans flou ni voyant) |
| `favicon.ico` | 16 + 32 + 48 px, pour les vieux navigateurs et `/favicon.ico` |
| `favicon-16.png`, `favicon-32.png` | Favicons PNG |
| `apple-touch-icon.png` | 180 px, plein cadre (iOS arrondit lui-même) |
| `icon-192.png`, `icon-512.png` | Icônes PWA / Android |
| `icon-maskable.svg`, `icon-maskable-512.png` | Version maskable Android, le motif tient dans la zone de sécurité |
| `og-image.png` | Image de partage 1200×630 pour hashboard.live |
| `site.webmanifest` | Manifest PWA |

## Palette

- Fond : `#22223a` → `#0b0b14`, puce `#1b1b2c` → `#11111c`
- Néon : `#5fdcff` → `#00b4ff` → `#8b7cf6`
- Pouls : `#ffd54f` → `#ff9800`
- Voyant : `#66bb6a`
- Arrondis : tuile `rx 64/512` (12,5 %), puce `rx 24`

## Où chaque fichier est utilisé

| Où | Fichiers | Déclarés dans |
|---|---|---|
| App (local et boards distants) — `ui/public/` | `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` | `ui/index.html` ; `favicon.svg` sert aussi de logo au menu replié (`Sidebar.tsx`) |
| Site de doc — `docs/` | `favicon.ico`, `favicon.svg`, `apple-touch-icon.png` | `docs/_includes/head_custom.html` (le thème déclare `favicon.ico` de lui-même) |
| hashboard.live — `ui/public/` du dépôt hashboard | les mêmes que l'app, plus `og-image.png` | `ui/index.html` et `ui/scripts/prerender.mjs` (guides) |

Le `site.webmanifest` de l'app prend la couleur de fond de l'app (`#1e1e2a`) ; celui de ce dossier et de hashboard.live garde `#0f0f1a`.

`icon-192.png` est aussi le logo des mails HTML, embarqué dans le mailer sous `server/internal/mailtemplate/logo.png`.

`icon.svg`, `icon-maskable.svg`, `favicon-16.png` et `favicon-32.png` ne sont copiés nulle part : ce sont les sources et les variantes à disposition.
