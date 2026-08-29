# Plan — Détection auto des mineurs + config via l'UI

Statut : **Toutes les phases faites** (1 à 5) — discovery backend, UI de
détection, sauvegarde effective, rechargement à chaud, et simplification
des flags (`-miners` supprimé). Fonctionnalité complète, testée en
conditions réelles à chaque étape.

Ordre des phases choisi pour pouvoir tester à chaque étape plutôt que
d'attendre la fin : d'abord l'API de détection (déjà testable au curl),
puis l'UI qui l'utilise (testable visuellement, sans persistance réelle
encore), puis la sauvegarde effective (testable de bout en bout : ajouter
un mineur, le voir apparaître dans `miners.yml`), puis le rechargement à
chaud (testable en confirmant que le feeder capte le changement sans
redémarrage).

## Objectif

Simplifier l'installation d'axeos-dashboard : plus besoin d'écrire `miners.yml`
à la main. Une nouvelle page `/settings` (mode local uniquement, jamais en
remote) permet de :

1. **Scanner le réseau** pour détecter automatiquement les devices AxeOS
   (bitaxe/nerdaxe) présents sur le LAN.
2. **Ajouter un device manuellement par IP** quand le scan ne le trouve pas
   (autre sous-réseau, pare-feu, etc.) — même logique de sondage qu'en (1),
   appliquée à une seule IP.
3. Éditer/supprimer les mineurs déjà configurés.

Le fichier de config des mineurs reste stocké sur disque (feeder et
dashboard-api en ont besoin), mais devient **géré par l'application** au lieu
d'être un prérequis fourni à la main. `dashboard.yml` (config globale, avec
ses commentaires) n'est jamais généré ni réécrit par cette fonctionnalité.

## Décisions actées

- **Rechargement à chaud** (pas de redémarrage requis après un ajout/édition) :
  feeder et dashboard-api détectent le changement du fichier managé via son
  `mtime` et rechargent la liste des mineurs en mémoire.
- **Pas de flag `-miners` requis pour éditer** : le fichier managé a un
  chemin par défaut fixe (ex. `{dataDir}/miners.yml`), créé automatiquement
  s'il n'existe pas. `-miners` reste disponible comme override de chemin,
  mais n'est plus une étape d'installation obligatoire.
- **Pas de code de migration** : le format du fichier managé est identique à
  l'actuel `bitaxes: [...]` de `miners.yml`. Un fichier existant (ex. celui en
  prod sur le Raspberry Pi) est chargé tel quel, sans transformation. Seul
  point d'attention : une entrée créée depuis l'UI (scan ou ajout par IP) doit
  poser explicitement `enabled: true` (zero-value Go d'un bool = `false`, ça
  ne vient pas gratuitement).
- **`poolSchedule` (cron) reste hors scope** : toujours éditable à la main
  dans le fichier YAML pour les besoins avancés ; le `PoolScheduler` reste
  figé au démarrage, pas concerné par le hot-reload de cette fonctionnalité.

## Ce qui a été trouvé dans le code (repères)

- `server/internal/config/loader.go` : `LoadConfig` charge `dashboard.yml` +
  optionnellement un `miners.yml` séparé via `-miners` (`WithMiners`), qui
  *remplace* entièrement `config.Bitaxes`.
- `server/internal/config/config.go` : `Bitaxe.StorageKey()` = MAC normalisée
  (sans séparateurs, minuscule) = clé de stockage. `GetMiners()` filtre sur
  `Enabled`.
- `server/internal/bitaxe/client.go` : `FetchSystemInfo(ctx, addr)` fait un
  `GET http://{ip}/api/system/info` (port 80 implicite, pas de port custom
  par device) — c'est la même primitive à réutiliser pour le scan/probe.
- `server/internal/handler/miners.go` (`PayloadStructure`) : la réponse d'un
  device contient déjà `stratumURL`, `stratumUser`, `fallbackStratumURL`,
  `fallbackStratumUser`, `macAddr`, `hostname` — exploitable pour pré-remplir
  le formulaire d'ajout avec ce que le device a déjà configuré en usine/avant.
- Distinction bitaxe/nerdaxe : présence du champ `deviceModel` dans la
  réponse (nerdaxe l'a, bitaxe non) — heuristique à valider sur du matériel
  réel (4 bitaxe + 1 nerdaxe déjà dans `resources/miners.yml`).
- `server/cmd/remote-dashboard-api/router.go` : routeur complètement séparé
  de `cmd/dashboard-api/router.go` — il suffit de ne rien y ajouter pour
  garantir qu'aucune édition de config n'est jamais possible en mode remote.
- `Makefile` : le target `restart` fait actuellement un hard-fail si
  `MINERS_FILE` est défini mais absent (lignes ~357-358) — à assouplir,
  l'absence de fichier n'est plus une erreur puisque l'app le crée elle-même.

## Plan par phases

### Phase 1 — Discovery (lecture seule) — ✅ Fait

Diffère du plan initial sur deux points : pas de DTO `DiscoveredDevice`
séparé (la réponse est directement des `config.Bitaxe`, cf. décision prise en
cours de route ci-dessous), et un paramètre `timeout` en plus (pas prévu au
départ, ajouté après un premier test réel à ~30s pour un scan complet).

- `server/internal/discovery/discovery.go` :
  - `Probe(ctx, endpoint string, timeout time.Duration, ip string) (config.Bitaxe, error)`
    — sonde une IP, retourne directement un `config.Bitaxe` prêt à
    sauvegarder (`enabled: true`, hostname/mac/modèle deviné/pools déjà
    réglés côté device — y compris `port`/`fallbackPort`, lus depuis
    `stratumPort`/`fallbackStratumPort` dans la réponse du device, mêmes
    clés que celles utilisées côté écriture par `config.BitaxeServerSettings`).
  - `Scan(ctx, endpoint string, timeout time.Duration, cidr string) ([]config.Bitaxe, error)`
    — sonde tous les hôtes de `cidr` en parallèle (40 en simultané), même
    logique que `Probe` par hôte. Borné à un `/24` (254 hôtes) ; un masque
    plus large est rejeté immédiatement sur la taille du masque, sans
    énumérer les adresses (évite d'expanser un `/8` en 16M entrées juste
    pour le rejeter).
  - `LocalCIDR() (string, error)` — détecte le `/24` de l'interface réseau
    locale (`net.InterfaceAddrs()`), utilisé comme valeur par défaut quand
    ni `ip` ni `cidr` ne sont fournis.
  - `DefaultProbeTimeout = 1s`, `MaxProbeTimeout = 3s` — voir plus bas.
  - Détection modèle bitaxe/nerdaxe : présence du champ `deviceModel` dans
    la réponse (nerdaxe l'a, bitaxe non) — **validé sur du matériel réel**
    (4 bitaxe + 1 nerdaxe).
  - Pas de champ `alreadyConfigured` : le diff avec la liste déjà configurée
    se fera côté UI (Phase 2), pas dans la réponse API — décision prise
    pour garder le contrat simple et directement réutilisable tel quel pour
    le futur `POST` de sauvegarde (Phase 3).
- `server/internal/handler/config.go` : `GET /api/config/discover`, montée
  uniquement dans `cmd/dashboard-api/router.go` (absente de
  `remote-dashboard-api`, vérifié). Paramètres :
  - `ip` — sonde une seule IP (prioritaire si `cidr` est aussi fourni).
  - `cidr` — scanne une plage (max `/24`) ; si omis (et `ip` aussi), scanne
    automatiquement le `/24` local du serveur.
  - `timeout` — timeout par sonde, ex. `500ms`/`2s` (défaut `1s`, plafonné à
    `3s` pour rester sous le timeout global de 30s du routeur chi sur un
    scan complet : 7 vagues × 3s = 21s). Ajouté après un premier test réel
    où un scan complet sans rien trouver prenait ~30s avec l'ancien
    `endpoints.timeout` (5s, pensé pour le polling normal, pas la
    découverte) — un scan à vide prend maintenant ~7s par défaut ; le
    paramètre permet de le remonter à la main si le réseau est lent et
    qu'un premier passage rapide n'a rien trouvé (pas d'auto-retry
    automatique implémenté côté backend — c'est à l'UI de proposer ce
    "relancer avec un timeout plus long", Phase 2).
  - Réponse : `{"bitaxes": [...]}`, même forme que `miners.yml`.
- Tests : `discovery_test.go` (probe bitaxe/nerdaxe/device invalide/
  injoignable, cap `/24`, expansion CIDR, timeout param), `handler/
  config_test.go`, un test de routage dans `handler_routes_test.go`.
- Swagger régénéré et annotations `@Param` détaillées pour `ip`/`cidr`/
  `timeout` (utilité de chaque paramètre, priorité `ip` > `cidr`,
  comportement par défaut).

**Changement adjacent (hors plan initial), fait pendant cette phase** :
`config.Bitaxe.RestartAfterUpdate` supprimé — `SwitchPool`/`SetWifi`
(`internal/axeos/service.go`) redémarrent maintenant le device
systématiquement après application, au lieu de dépendre d'un flag par
mineur. Décidé par l'utilisateur : la perte de compteurs (shares, etc.) au
redémarrage n'est plus un problème depuis que ces données sont agrégées
dans le temps plutôt que lues en instantané.

### Phase 2 — UI (découverte + lecture seule) — ✅ Fait

Diffère du plan initial sur un point assumé : pas de bouton "Enregistrer"
(même désactivé) sur les cartes de résultats — l'endpoint d'écriture
n'existe pas encore (Phase 3), un bouton mort aurait fait moins propre
qu'un simple bandeau d'info expliquant que la sauvegarde arrive. Pareil pour
le tableau des mineurs déjà configurés : lecture seule pour l'instant (pas
d'édition/suppression inline, ça aussi dépend des endpoints d'écriture).

- `GET /api/config/miners` ajouté côté backend (`handler.ListMinersConfig`) :
  lecture seule, expose `cfg.Bitaxes` **tel quel, y compris les mineurs
  désactivés** (pas juste `cfg.GetMiners()` qui filtre sur `enabled` — le
  but ici est de montrer l'état réel de `miners.yml`, pas la liste utilisée
  pour le polling).
- Nouvelle page `ui/src/pages/Settings.tsx`, route `/settings` dans
  `App.tsx` (pas de route `/:boardId/settings`), nouvel item de nav dans
  `Sidebar.tsx` (`{!boardId && <NavItem .../>}` — absent en mode remote).
- **Redirection à l'arrivée si aucun mineur configuré** : nouveau composant
  `ui/src/components/ui/RequireMinersConfigured.tsx`, qui enveloppe les
  routes locales `/` et `/alerts` (pas `/settings` elle-même, ni les routes
  remote `/:boardId*`) et redirige vers `/settings` tant que
  `GET /api/config/miners` renvoie une liste vide.
- UX de la page :
  1. Tableau des mineurs déjà configurés (si non vide) — nom, IP, MAC,
     modèle, statut activé/désactivé.
  2. Bandeau d'info : la sauvegarde depuis cette page arrive en Phase 3.
  3. Section "Détection automatique" (mode simple) : un bouton lance
     `GET /api/config/discover` sans CIDR (auto-détection du `/24` serveur).
  4. Section "Ajouter par IP" : champ IP + bouton → sondage unique
     (`/api/config/discover?ip=...`).
  5. Résultats en cartes : statut Nouveau/Déjà configuré (diff MAC
     normalisée côté UI contre la liste déjà configurée, pas renvoyé par
     l'API), modèle, pool principal/secours si présents sur le device.
  6. Aucun résultat ou erreur → message + bouton "Réessayer avec un délai
     plus long" (rejoue la dernière recherche, scan ou IP, avec
     `timeout=3s`).
- Nouveaux fichiers : `hooks/useDiscovery.ts`, `hooks/useMinersConfig.ts`
  (TanStack Query), `schemas/minerConfigSchema.ts` (Zod, miroir de
  `config.Bitaxe`), `components/ui/RequireMinersConfigured.tsx`, textes
  FR/EN dans `locales/`. `utils/boardId.ts` : `"settings"` ajouté à
  `LOCAL_ONLY_ROUTES` (sinon `/settings` serait pris pour un boardId
  remote).
- Tests : `internal/handler/config_test.go` (`ListMinersConfig`), routage
  dans `handler_routes_test.go`, `boardId.test.ts` mis à jour. Suite Go
  complète + suite UI (194 tests) vertes, `typecheck`/`lint`/`build`
  propres.

**Bonus (hors plan), corrigé en cours de route** : `ui/eslint.config.js`
n'excluait pas `dist/` (artefact de build gitignored) — `npm run lint`
remontait des centaines d'erreurs sans rapport sur le bundle minifié.
Ajout d'un `ignores: ["dist/**", "dist-ssr/**"]`.

### Phase 3 — Sauvegarde effective — ✅ Fait

Diffère du plan initial sur plusieurs points :

- **Pas de chemin par défaut auto quand `-miners` est omis** : `MinersFilePath`
  reste vide dans ce cas, `POST /api/config/miners` répond `409` ("pas de
  fichier managé"). Décision reprise de la réponse initiale ("désactiver
  l'édition") plutôt que d'inventer un chemin par défaut qui aurait pu
  silencieusement ignorer un `bitaxes:` écrit à la main dans
  `dashboard.yml` pour qui n'utilise pas `-miners`. Sans impact réel : le
  Makefile passe `-miners resources/miners.yml` par défaut dans tous les
  cas.
- **Pas de `DELETE /api/config/miners/{mac}`, pas d'édition/suppression
  inline sur le tableau des mineurs configurés** : hors scope de cette
  passe (le besoin exprimé était "sélectionner des mineurs détectés et les
  enregistrer", pas éditer l'existant) — laissé pour un futur ajustement.
- **Sélection multiple plutôt qu'un bouton "Ajouter" par carte** : case à
  cocher sur chaque carte "Nouveau" (les "Déjà configuré" n'en ont pas),
  bouton "Enregistrer la sélection (N)" qui envoie tous les mineurs cochés
  en un seul `POST` (le endpoint accepte un tableau, upsert par MAC —
  fonctionne aussi bien pour un ajout unique que pour plusieurs à la fois).
- **Reflet immédiat côté même process, distinct du hot-reload de la
  Phase 4** : après un save réussi, le `Router` de dashboard-api met à jour
  son propre `config.Bitaxes` en mémoire (`Router.setBitaxes`, protégé par
  un `sync.Mutex` — tous les handlers passent maintenant par
  `f.snapshotConfig()`), donc `GET /api/config/miners` (et la page
  `/settings`) reflète la sauvegarde sans redémarrage. **Le feeder** (process
  séparé) et les boucles internes de dashboard-api (health-check, pool
  scheduler) n'en profitent pas — elles ne verront le nouveau mineur
  qu'après un redémarrage, ou une fois la Phase 4 (rechargement à chaud
  inter-process, par `mtime`) faite. Le toast de succès le dit explicitement
  ("redémarre le feeder pour qu'il commence à les interroger").

Ce qui a été fait :

- `config.Config.MinersFilePath` (runtime, `yaml:"-"`), posé par le loader
  quand `-miners` est passé.
- `internal/config/writer.go` : `SaveMiners(path, miners) error` — marshal
  YAML, écriture atomique (temp + `os.Rename`), backup horodaté
  (`.bak-<UTC timestamp>`) avant écrasement, no-op si rien n'existait avant.
- **Fix bloquant trouvé en testant manuellement** : `loadMiners()` échouait
  (`log.Fatalf`, le process ne démarrait pas) si le fichier `-miners`
  n'existait pas encore — bloquait toute installation fraîche. Corrigé :
  fichier absent = liste vide (pas une erreur) ; un fichier existant mais
  invalide reste une vraie erreur.
- `POST /api/config/miners` (`handler.SaveMinersConfig`) : upsert par MAC
  normalisée (`upsertBitaxes`), force `enabled: true` sur une entrée
  vraiment nouvelle, respecte `enabled` tel quel sur une mise à jour,
  rejette les MAC dupliquées dans une même requête, valide
  ip/hostname/mac (`validateBitaxe`). Renvoie la liste complète mise à
  jour.
- Frontend : `useMinersConfig` gagne `saveMiners`/`isSaving`/`saveError` ;
  `Settings.tsx` gagne les cases à cocher, le bouton "Enregistrer la
  sélection", un `Snackbar` de succès, une `Alert` d'erreur. Nouvel utilitaire
  partagé `utils/apiError.ts` (`extractErrorMessage`, dédupliqué entre
  `useDiscovery` et `useMinersConfig`).
- Tests : `internal/config/writer_test.go` (écriture, backup, création du
  dossier parent, pas de fichier temp résiduel), `handler/config_test.go`
  (validation, upsert nouveau/existant, MAC dupliquée, `409` sans
  `MinersFilePath`), `cmd/dashboard-api` (le `GET` qui suit un `POST` sur le
  même routeur reflète bien le save). Suite Go complète + `-race` sur les
  packages touchés : verts. Suite UI (194 tests) + `typecheck`/`lint`/
  `build` : verts.
- **Vérifié en conditions réelles** (backend démarré localement, `curl`) :
  cycle vide → POST 2 mineurs → GET immédiat les montre → contenu du
  fichier YAML correct → second POST (mise à jour d'un des deux, MAC dans
  un format différent) → backup créé, `enabled` respecté, mise à jour en
  place (pas de doublon) → requête invalide → `400` avec message clair.

### Phase 4 — Rechargement à chaud — ✅ Fait

- `server/internal/config/live.go` : `MinersStore` (mutex + slice + `mtime`).
  `Reload()` re-lit le fichier managé si son `mtime` a changé (sinon un seul
  `os.Stat`, pas de re-parsing) ; fichier absent → liste vide (pas une
  erreur, cohérent avec le fix de la Phase 3) ; YAML invalide → garde le
  dernier état connu plutôt que de vider la liste pour un souci
  transitoire. `Set()` : mise à jour immédiate en mémoire (utilisé juste
  après une écriture par ce même process, pour ne pas dépendre de la
  résolution de `mtime` du filesystem).
  - **Bug attrapé par les tests avant tout câblage** : `NewMinersStore`
    pré-remplissait `modTime` en stat'ant le fichier à la construction, ce
    qui faisait que le tout premier `Reload()` voyait un `mtime` "inchangé"
    et ne relisait jamais le contenu réel du fichier. Corrigé : `modTime`
    démarre à zéro, le premier `Reload()` relit toujours.
- Intégration via un pattern `WithMinersStore(store)` (builder, comme
  `LoadConfig.WithMiners`) plutôt qu'un paramètre de constructeur — évite de
  casser tous les tests existants qui construisent `Router`/`Watcher`/
  `Feeder` directement sans se soucier du hot-reload :
  - `Router.snapshotConfig()` : recharge à chaque requête (coût quasi nul
    si rien n'a changé).
  - `healtcheck.Watcher.Watch()` : recharge en tête de cycle.
  - `Feeder.runOnce()` : recharge en tête de cycle.
  - `PoolScheduler` : **pas** concerné (reste figé au démarrage, limitation
    documentée dès le départ).
  - dashboard-api partage **une seule instance** de `MinersStore` entre le
    `Router` et le `Watcher` (même process) — un `POST` bénéficie donc
    immédiatement aux deux, pas seulement au `Router`.
- L'ancien mécanisme mutex ad hoc de la Phase 3 (`Router.setBitaxes`) est
  supprimé, remplacé par `minersStore.Set(merged)` — `Router.config` n'est
  plus jamais muté après construction.
- Pas de `DELETE /api/config/miners/{mac}` (toujours hors scope, cf. note
  Phase 3) — seul le rechargement du `POST` existant est concerné ici.
- UI : le message de succès dit maintenant "actif dans quelques instants"
  au lieu de "redémarre le feeder" (`useMinersConfig.ts` et les
  traductions mis à jour en conséquence).
- Tests : `internal/config/live_test.go` (reload/no-op/erreur/`Set`/copie
  défensive), tests d'intégration dédiés dans `healtcheck` et `cmd/feeder`
  (un mineur ajouté au fichier *après* la construction du `Watcher`/
  `Feeder` est bien capté au cycle suivant), tests de routeur (reflet
  immédiat + reprise d'une modification externe du fichier). Suite Go
  complète + `-race` sur les packages touchés : verts.
- **Vérifié en conditions réelles** : `dashboard-api` et `feeder` lancés
  comme deux vrais process séparés (binaires compilés, pas juste des tests
  Go), avec des intervalles courts pour observer vite. Écriture à la main
  dans `miners.yml` pendant que les deux tournaient → les logs des deux
  process montrent une tentative de contact du nouveau mineur au cycle
  suivant, sans redémarrage, `GET /api/config/miners` le reflète aussi.
  (Le test n'a pas pu aller jusqu'à un fetch réussi faute de pouvoir lier
  le faux device sur le port 80 sans privilèges root dans cet
  environnement — le cycle complet reload→fetch→écriture est cependant
  déjà prouvé par le test Go d'intégration du feeder, qui lui n'a pas
  cette contrainte de port.)

**Bug préexistant trouvé en testant la désactivation d'un mineur en
conditions réelles** (sans rapport avec le hot-reload lui-même) :
`Feeder.runOnce` bouclait sur `f.config.Bitaxes` (tous les mineurs, y
compris désactivés) au lieu de `f.config.GetMiners()` (filtré sur
`enabled`) — `Watcher` et `PoolScheduler`, eux, filtraient déjà
correctement. Un mineur désactivé disparaissait bien du tableau (API
filtrée) mais le feeder continuait à l'interroger et à écrire ses données.
Corrigé (`cmd/feeder/feeder.go`), test de non-régression ajouté
(`TestFeeder_runOnce_skipsDisabledMiner`).

**Ajustements UX post-Phase 4** (demandés après coup, sur la page
`/settings`) :
- "Tout sélectionner"/"Tout désélectionner" sur les résultats de
  découverte (n'affecte jamais les mineurs déjà configurés).
- Bouton bascule Activer/Désactiver par ligne dans le tableau des mineurs
  configurés (réutilise le `POST` existant, aucun changement backend).
- "Tout désactiver" (kill switch en cas de problème) avec confirmation
  (`ConfirmDialog`), un seul appel `POST` pour tous les mineurs actifs.

### Phase 5 — Simplification des flags — ✅ Fait (dépasse le plan initial)

Va plus loin que prévu : au lieu d'assouplir le hard-fail sur `MINERS_FILE`
absent, le flag `-miners` est **entièrement supprimé** (des trois binaires :
`dashboard-api`, `feeder`, `rebuild-totals`) — plus rien à garder synchronisé
entre les process, plus de piège possible du type "un des deux a oublié le
flag".

- `internal/config/config.go` : nouveau champ `MinersFile` (clé YAML
  optionnelle `minersFile:` dans `dashboard.yml`, pour déplacer le fichier
  managé ailleurs que l'emplacement par défaut). `MinersFilePath` (champ
  runtime déjà existant) devient toujours renseigné après un `LoadConfig()`
  réussi.
- `internal/config/loader.go` : `LoadConfig()` résout désormais toujours un
  chemin de fichier managé — `minersFile:` si renseigné, sinon
  `miners.yml` à côté du fichier `-config`. Suppression de `WithMiners`/du
  champ `minersPath` (plus utilisés) ; `loadMiners` devient une fonction de
  paquet `loadMinersFile(path)`.
- **Changement de comportement assumé** : un bloc `bitaxes:` écrit à la
  main dans `dashboard.yml` n'est plus jamais lu — le fichier managé est
  désormais la seule source. Sans risque en pratique : le pattern
  `-miners resources/miners.yml` du Makefile était déjà le défaut partout,
  et `resources/miners.yml` est déjà positionné exactement là où la
  nouvelle convention l'attend (à côté de `resources/dashboard.yml`).
- Les trois `main.go` (`dashboard-api`, `feeder`, `rebuild-totals`) perdent
  le flag `-miners`.
- `Makefile` : suppression de `MINERS_FILE`/`MINERS_FLAG` et de toutes
  leurs utilisations (`run-dashboard-api`, `run-feeder`, `rebuild-totals`,
  `dev-up`, `latest-up`, `restart`), y compris le hard-fail devenu obsolète.
- Tests réécrits (`loader_test.go`) pour couvrir : défaut par voisinage,
  override via `minersFile:`, fichier manquant (liste vide), YAML invalide
  (erreur), et un test dédié prouvant que `bitaxes:` inline est bien
  ignoré. `writer_test.go` adapté à `loadMinersFile`.
- Docs mises à jour : `README.md` (Quick Start, section Configuration,
  exemple `dashboard.yml`), `DEPLOYMENT.md` (systemd, lancement manuel des
  binaires), `CLAUDE.md` (exemple de config splitté en deux blocs
  `dashboard.yml`/`miners.yml`, plus une correction au passage : les champs
  de pool y étaient documentés comme `primary:`/`fallback:` imbriqués alors
  que le vrai schéma est plat `url`/`port`/`user`/`fallbackUrl`/...).
- Swagger régénéré (shape de `config.Bitaxe`/`Config` changée).
- **Vérifié en conditions réelles** : `make build` + `make run-dashboard-api`
  (commande exacte, sans aucun flag `-miners`) → les 5 mineurs réels de
  `resources/miners.yml` sont chargés automatiquement, confirmé via
  `GET /api/config/miners`. `make -n restart`/`run-feeder` : plus aucune
  référence à `-miners`/`MINERS_FILE`, syntaxe Makefile propre. Suite Go
  complète verte (même flake feeder préexistant, sans rapport).

**Ajustement post-déploiement : le flag `-miners` redevient accepté, mais
en no-op déprécié** (au lieu d'être supprimé pur et dur), suite à
l'inspection du Pi de prod :
- Son vrai `config.yml`/`miners.yml` vivent hors du dépôt git
  (`/home/.../axeos-bitaxe-dashboard/`), déjà côte à côte — la nouvelle
  convention par défaut les trouve sans rien changer.
- Mais `axeos-dashboard.service` (systemd, `enabled`, donc relancé à
  chaque reboot) invoque `make latest-up`, qui télécharge les binaires
  depuis la **release GitHub `latest`** (pas ce qui est testé/déployé en
  local) — tant que cette fonctionnalité n'est pas mergée + republiée, un
  reboot inopiné y ferait tourner un **ancien binaire** avec le **nouveau**
  Makefile (ou l'inverse selon l'ordre des mises à jour). Avec le flag
  purement supprimé : soit crash immédiat (nouveau binaire + `-miners`
  passé), soit pire — plantage silencieux, aucun mineur suivi (ancien
  binaire + pas de `-miners`, retombe sur un `bitaxes:` vide dans
  `config.yml`).
- Solution retenue (proposée par l'utilisateur) : `-miners` reste déclaré
  dans les trois binaires (`dashboard-api`, `feeder`, `rebuild-totals`)
  mais sa valeur n'est plus utilisée pour résoudre le chemin des mineurs
  (seule la résolution par voisinage / `minersFile:` compte désormais) —
  juste un warning loggé s'il est fourni. Le Makefile redéclare donc aussi
  `MINERS_FILE`/`MINERS_FLAG` et les repasse à `dashboard-api`/`feeder`/
  `rebuild-totals` comme avant. Résultat : toute combinaison
  ancien/nouveau binaire × ancien/nouveau Makefile fonctionne pendant la
  fenêtre de transition, sans dépendre de l'ordre dans lequel Pi et
  binaires sont mis à jour, et sans toucher à systemd.
- Vérifié : binaire reconstruit + lancé avec `-miners /chemin/inexistant.yml`
  → démarre normalement, log `WARN -miners is deprecated and ignored`, pas
  de crash (avant ce correctif : `flag provided but not defined: -miners`,
  exit 2). Suite Go complète toujours verte.

**Bug UI trouvé en testant le parcours complet** (config vide → configurer
via `/settings` → retour sur "Accueil") : le tableau de bord restait vide
tant qu'on n'avait pas rechargé la page à la main. Deux causes cumulées :
1. `RequireMinersConfigured` affichait `Home` (donc déclenchait
   `useMiners()`) pendant que la vérification de config était encore en
   cours de chargement — si ça arrivait une fois avec une config vide, le
   résultat vide restait en cache pour le reste de la session
   (`useMiners` a `staleTime: Infinity`). Corrigé : un spinner s'affiche
   tant que la vérification n'est pas terminée, `Home` ne monte jamais
   prématurément.
2. Une sauvegarde réussie depuis `/settings` n'invalidait jamais le cache
   de `useMiners()` (`GET /api/miners`, utilisé par le tableau de bord) —
   seul le cache de la page `/settings` elle-même était rafraîchi. Corrigé
   dans `useMinersConfig.saveMiners` : `queryClient.invalidateQueries({
   queryKey: ["miners"] })` après chaque sauvegarde réussie.

**Rafraîchissement au clic dans la sidebar** : demande initiale mal résolue
deux fois avant la bonne approche.
- 1ère tentative : `queryClient.invalidateQueries()` global à chaque clic
  sur un lien de la sidebar → trop large, rafraîchissait des pages non
  visibles (ex. cliquer sur "Alertes" invalidait aussi `/api/miners`).
- 2ème tentative : mapping manuel clé de cache ↔ lien de la sidebar
  (`"miners"` pour Accueil, `"alertsHistory"` pour Alertes, `"config"` pour
  Settings) → rejetée par l'utilisateur comme bidouille fragile (la
  sidebar n'a pas à connaître les clés de cache de chaque page, et ça
  suppose à tort qu'une page n'utilise qu'une seule source de données —
  Alertes utilise `useMiners()` en plus de `useAlertsHistory()`, cf.
  point suivant).
- **Solution retenue** : chaque hook de page se déclare lui-même
  "toujours frais au montage" (`refetchOnMount: "always"` sur
  `useMiners`/`useAlertsHistory` ; `useMinersConfig` avait déjà
  `staleTime: 0`, donc rien à changer). La sidebar redevient un simple
  composant de navigation, sans aucune connaissance du cache. Arriver sur
  une page — peu importe le moyen (clic sidebar, retour navigateur, lien
  direct) — redéclenche toujours un fetch, comme un F5 ciblé sur cette
  page.

### Post-Phase 5 — Ajustements UX supplémentaires — ✅ Fait

Demandés après la déclaration "toutes les phases faites", sur la page
`/settings` :

- **Badge "Déjà configurée" retiré** : il se basait sur un diff MAC figé au
  moment du scan et devenait trompeur dès qu'un mineur changeait de config
  (pool, IP) en dehors du dashboard. Les cartes de résultats restent
  sélectionnables qu'elles soient nouvelles ou déjà configurées — plus
  aucune distinction visuelle ni de restriction de clic.
- **Ré-écriture d'un mineur déjà configuré permise** : sélectionner un
  device déjà présent dans `miners.yml` et l'enregistrer met à jour son
  entrée en place (ip/hostname/model/pool rafraîchis depuis ce que le
  device rapporte maintenant), mais `enabled` et `poolSchedule` de
  l'entrée existante sont **conservés tels quels** côté UI avant l'envoi
  (`Settings.tsx`, `devicesToSave`) — un scan/sonde ne connaît ni l'un ni
  l'autre (champs avancés, jamais renvoyés par le device), donc les
  écraser aurait pu ré-activer silencieusement un mineur désactivé
  intentionnellement, ou effacer sa planification cron.
- **"Tout sélectionner" couvre désormais tous les résultats**, pas
  seulement les nouveaux — permet un rafraîchissement complet du fichier
  en un scan + un save, cas d'usage explicite ("je veux pouvoir
  rafraîchir le fichier intégralement").
- Comparaison état `enabled`/`poolSchedule` toujours par **MAC normalisée**
  uniquement (`configuredByMac`), jamais par IP — un mineur qui redémarre
  et change d'IP (DHCP) est quand même reconnu correctement.
- i18n : clés `discovery.new`/`discovery.alreadyConfigured`/
  `discovery.alreadyConfiguredHint` supprimées (EN+FR), devenues inutiles.

**Date de dernière modification de `miners.yml`** — ✅ Fait (petit ajout,
même zone de code) :

- `internal/config/writer.go` (`SaveMiners`) : préfixe le fichier écrit
  d'un commentaire `# Last updated: <RFC3339 UTC>` à chaque sauvegarde.
- `GET /api/config/miners` (list et save) renvoie un champ top-level
  `lastUpdated` (RFC3339, mtime réel du fichier via `os.Stat` — pas
  seulement le commentaire, donc reste correct même si le fichier a été
  édité à la main) ; absent/omis si aucun fichier managé n'existe encore.
  `remote-dashboard-api` n'est pas concerné (pas de route `/api/config/*`).
- UI : affiché sous le titre du tableau "Mineurs configurés"
  (`settingsPage.configured.lastUpdated`, EN+FR).
- Tests : `writer_test.go` (header présent, RFC3339, mis à jour à chaque
  save), `handler/config_test.go` (`lastUpdated` renvoyé si fichier
  managé présent, omis sinon).

## À faire plus tard (commit séparé)

- **Filtres de la page Alertes mal conçus** : `Alerts.tsx` appelle
  `useMiners()` (`/api/miners`) uniquement pour peupler le menu déroulant
  du filtre IP — hors sujet architecturalement. Sur cette page, le
  **jour** est la seule vraie recherche (interroge le serveur via
  `/api/miners/alerts/history?date=...`) ; le filtre **IP** et le filtre
  **Type** ne sont que des filtres appliqués à la réponse déjà reçue pour
  ce jour-là, et devraient donc être dérivés de `data.episodes` (qui porte
  déjà `minerIp`/`hostname`/`type` par épisode), pas d'un appel séparé à
  la liste des mineurs. Bénéfice en plus de la suppression de la
  dépendance à `useMiners()` : le filtre IP ne proposerait plus des
  mineurs sans aucune alerte ce jour-là (options qui aujourd'hui ne
  filtrent rien une fois sélectionnées).

## Garde-fous transverses

- Scan/probe toujours déclenché manuellement, jamais en tâche de fond.
- Écriture YAML uniquement sur le fichier managé des mineurs, jamais sur
  `dashboard.yml`.
- Aucune route `/api/config/*` sur `remote-dashboard-api`.
