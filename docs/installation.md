---
title: Installation
nav_order: 2
---

# Installation

axeos-dashboard tourne partout où Docker est disponible — un Raspberry
Pi, un NAS, un serveur Linux, ou votre propre machine (Linux / Windows /
macOS). Pas besoin de toolchain Go ou Node pour cette méthode.

## Prérequis

- **Docker** installé et démarré sur la machine cible.
- C'est tout — pas de configuration manuelle de nginx ou systemd, pas de
  fichier de config à écrire à la main.

## Installation en une ligne

Exécutez ceci sur la machine cible :

```bash
curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | bash
```

Cette commande unique :

1. Crée un dossier `./axeos-dashboard/` dans le répertoire depuis lequel
   vous l'avez lancée (faites `cd` ailleurs d'abord si vous voulez un
   autre emplacement).
2. Télécharge `docker-compose.yml` et un modèle de config `dashboard.yml`.
3. Récupère les deux images multi-arch pré-construites (`linux/amd64` +
   `linux/arm64`) depuis `ghcr.io/joakim-ribier/axeos-dashboard` et les
   démarre.
4. Affiche le port sur lequel l'UI a atterri.

Elle peut être relancée sans risque plus tard — elle n'écrase jamais un
`config/dashboard.yml` ou un `.env` existant.

## Choisir un port fixe

Par défaut, l'UI atterrit sur un **port libre aléatoire**, pour que
l'installation n'entre jamais en conflit avec autre chose déjà en cours
sur la machine. Vérifiez lequel avec :

```bash
docker compose ps
```

Si vous préférez un port fixe et mémorable (par exemple sur une machine
dédiée), passez `HTTP_PORT` à l'installation :

```bash
curl -fsSL https://raw.githubusercontent.com/joakim-ribier/axeos-dashboard/main/docker-install.sh | HTTP_PORT=80 bash
```

## Premier lancement

Ouvrez `http://<ip-machine>:<port>/` depuis n'importe quel appareil de
votre réseau local (ou `http://<ip-machine>/` si vous avez utilisé
`HTTP_PORT=80`).

Rendez-vous ensuite dans **Configuration** pour scanner votre réseau
local à la recherche de mineurs, ou en ajouter directement par IP —
aucun fichier de config à écrire à la main.

Rien d'autre à faire pour survivre à un redémarrage : les deux
conteneurs redémarrent automatiquement dès que Docker lui-même
redémarre.

## Mise à jour

Relancez exactement la même commande d'installation — elle récupère
l'image actuellement publiée sous le tag `latest`. Ou, depuis le dossier
d'installation `axeos-dashboard/` :

```bash
docker compose pull && docker compose up -d
```

## Logs

```bash
docker compose logs services    # feeder + dashboard-api
docker compose logs dashboard   # UI / nginx
```

## Et ensuite ?

- **Configuration** — référence complète des champs de `dashboard.yml` /
  `settings.yml` / `miners.yml` *(à venir)*
- **Fonctionnalités** — tour de chaque écran du dashboard *(à venir)*
