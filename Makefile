# ==============================================================================
# ⚙️  User Configuration — update these when deploying on a new server
# ==============================================================================

# The server, the only three values to change for yours: its SSH alias, the user
# its services run as, and its folder. `make deploy` copies there,
# `make install-services` writes them into deploy/*.service. Yours go in
# Makefile.local (same lines, not versioned -- `make init` writes it), which
# `make deploy` copies too. A
# := so a stale one exported in a shell can't send a deploy elsewhere; the
# command line still wins.
DEPLOY_HOST := server-dev
DEPLOY_USER := debian
DEPLOY_DIR  := /home/debian/axeos-bitaxe-dashboard
-include Makefile.local

# Listening port for dashboard-api (must match server.port in CONFIG)
DASHBOARD_API_PORT ?= 8080

# The UI dev server's port, fixed (--strictPort: a port in use fails rather
# than moving to the next one).
DASHBOARD_UI_PORT ?= 5174

# The configuration file every run-* target starts with
CONFIG ?= resources/dashboard.yml

BIN_DIR := resources/build/server/bin

# GitHub repo + release used by `make update` (CI-built binaries for the local
# architecture instead of building locally). No RELEASE_TAG: the last vX.Y.Z
# release; RELEASE_TAG=1.0.0 for release v1.0.0, RELEASE_TAG=latest for main's tip.
GITHUB_REPO ?= joakim-ribier/axeos-dashboard
RELEASE_TAG ?=

# Auto-detected local architecture, used to pick the right release asset
# (feeder-$(RELEASE_ARCH), dashboard-api-$(RELEASE_ARCH), ...). Override if
# `uname -m` reports something unexpected: make update RELEASE_ARCH=amd64
UNAME_ARCH := $(shell uname -m)
ifeq ($(UNAME_ARCH),x86_64)
RELEASE_ARCH ?= amd64
else ifeq ($(UNAME_ARCH),aarch64)
RELEASE_ARCH ?= arm64
else ifeq ($(UNAME_ARCH),arm64)
RELEASE_ARCH ?= arm64
else
RELEASE_ARCH ?= $(UNAME_ARCH)
endif

UI_DIR   := ui
BINARIES := dashboard-api feeder mailer rebuild-totals
SERVICES := axeos-dashboard-api axeos-dashboard-feeder axeos-dashboard-mailer

# Git SHA baked into each binary (exposed via GET /api/info as buildSHA) --
# lets you confirm you're running the version you expect.
GIT_SHA   := $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
GIT_DIRTY := $(shell git diff --quiet 2>/dev/null || echo -dirty)
VERSION_LDFLAGS := -ldflags "-X github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version.GitSHA=$(GIT_SHA)$(GIT_DIRTY)"

# Every binary of BINARIES into BIN_DIR; $(1): the GOOS/GOARCH to build for, none for this machine.
go-build = mkdir -p $(BIN_DIR) && cd server && for bin in $(BINARIES); do \
	$(1) go build $(VERSION_LDFLAGS) -o ../$(BIN_DIR)/$$bin ./cmd/$$bin || exit 1; done

.DEFAULT_GOAL := help
.PHONY: help init run run-dashboard-api run-feeder run-mailer run-dashboard-ui docker build build-ui clean \
	lint test swagger docs build-linux deploy \
	install-services install-aliases restart update versions rebuild-totals check-config

help: ## this list
	@awk 'BEGIN { FS = ":.*## " } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } \
		/^[a-z][a-zA-Z_ -]*:.*## / { n = split($$1, t, " "); printf "  \033[36m%-22s\033[0m %s\n", (n > 1 ? "run-<service>" : t[1]), $$2 }' $(MAKEFILE_LIST)

##@ Development -- on your machine

# Mailer first: the feeder and dashboard-api both call it. Each line is
# prefixed with the process it comes from; Ctrl+C stops them all.
run: build check-config ## the whole stack in this console: mailer, feeder, dashboard-api, UI (:5174) -- Ctrl+C stops it
	@trap 'kill 0' INT TERM; \
	$(BIN_DIR)/mailer -config $(CONFIG) 2>&1 | sed -l 's/^/[mailer] /' & \
	$(BIN_DIR)/feeder -config $(CONFIG) 2>&1 | sed -l 's/^/[feeder] /' & \
	$(BIN_DIR)/dashboard-api -config $(CONFIG) 2>&1 | sed -l 's/^/[api]    /' & \
	(cd $(UI_DIR) && API_PORT=$(DASHBOARD_API_PORT) npm run dev -- --port $(DASHBOARD_UI_PORT) --strictPort) 2>&1 | sed -l 's/^/[ui]     /' & \
	wait

run-dashboard-api run-feeder run-mailer: run-%: check-config ## one service alone, from the last build (CONFIG=...)
	$(BIN_DIR)/$* -config $(CONFIG)

run-dashboard-ui: ## the UI dev server alone → dashboard-api (:8080)
	cd $(UI_DIR) && API_PORT=$(DASHBOARD_API_PORT) npm run dev -- --port $(DASHBOARD_UI_PORT) --strictPort

docker: ## the Docker images from this checkout (uncommitted changes included), then the stack started (HTTP_PORT=...)
	./docker-build-dev.sh

build: ## compile dashboard-api, feeder, mailer, rebuild-totals
	$(call go-build,)

build-ui: ## build the UI (ui/dist)
	cd $(UI_DIR) && npm run build

clean: ## remove the compiled binaries
	rm -rf $(BIN_DIR)

# totals.json (uptime/shares/electricity counters that survive reboots) rebuilt
# from each miner's whole JSONL history. Dry run unless DRY_RUN= is given; the
# tool backs up any existing totals.json before writing it. Examples:
#   make rebuild-totals                              # dry run, all miners
#   make rebuild-totals MINER=aabbccddeeff DRY_RUN=  # for real, one miner
#   make rebuild-totals DRY_RUN= FALLBACK_RATE=0.15  # polls from before the rate was tracked at €0.15/kWh
DRY_RUN ?= 1
MINER ?=
FALLBACK_RATE ?=
rebuild-totals: check-config ## rebuild totals.json from the history (dry run unless DRY_RUN=; MINER=, FALLBACK_RATE=)
	$(BIN_DIR)/rebuild-totals -config $(CONFIG) -dry-run=$(if $(DRY_RUN),true,false) \
		$(if $(MINER),-miner $(MINER)) $(if $(FALLBACK_RATE),-fallback-rate $(FALLBACK_RATE))

##@ Quality -- on your machine

lint: ## golangci-lint on every Go package
	cd server && golangci-lint run ./...

test: ## the Go tests, with the race detector and coverage
	cd server && go test ./... -race -cover

# Also refreshes the copy the docs site's Redoc page (docs/en/api.md, docs/api.md) reads.
swagger: ## regenerate the OpenAPI spec from the handlers' annotations
	cd server && go tool swag init -g cmd/dashboard-api/main.go -o docs/swagger --outputTypes json,yaml --parseInternal
	cp server/docs/swagger/swagger.json docs/assets/api/swagger.json

docs: ## the docs site locally, rebuilt on every change
	cd docs && jekyll serve

##@ Deploy -- from your machine to DEPLOY_HOST, without a release

# Asked one by one, Enter keeps the value shown: Makefile.local's if there is
# one, else the defaults at the top of this file. The values it replaces stay
# below, commented and dated -- the last ones only; none when nothing changed.
init: ## write Makefile.local: the server's SSH alias, its user and its folder
	@printf 'SSH alias of the server [%s]: ' '$(DEPLOY_HOST)'; read host; \
	printf 'User its services run as [%s]: ' '$(DEPLOY_USER)'; read user; \
	printf 'Its folder [%s]: ' '$(DEPLOY_DIR)'; read dir; \
	new=$$(printf 'DEPLOY_HOST := %s\nDEPLOY_USER := %s\nDEPLOY_DIR  := %s' \
		"$${host:-$(DEPLOY_HOST)}" "$${user:-$(DEPLOY_USER)}" "$${dir:-$(DEPLOY_DIR)}"); \
	old=$$(grep -v '^#' Makefile.local 2>/dev/null | grep -v '^$$'); \
	if [ "$$new" = "$$old" ]; then echo ">>> Nothing changed, Makefile.local left as is:"; cat Makefile.local; exit 0; fi; \
	{ echo "$$new"; \
	  if [ -n "$$old" ]; then echo; echo "# Replaced on $$(date '+%Y-%m-%d %H:%M'):"; echo "$$old" | sed 's/^/# /'; fi; \
	} > Makefile.local.new && mv Makefile.local.new Makefile.local; \
	echo ">>> Makefile.local written:"; cat Makefile.local

build-linux: build-ui ## cross-compile the binaries for the Pi (linux/arm64) and build the UI
	$(call go-build,GOOS=linux GOARCH=arm64)

deploy: build-linux ## copy the binaries, the UI, deploy/ and this Makefile to DEPLOY_HOST -- then make restart on the server
	ssh $(DEPLOY_HOST) "mkdir -p $(DEPLOY_DIR)/dist/api $(DEPLOY_DIR)/dist/ui"
	rsync -avz $(BINARIES:%=$(BIN_DIR)/%) $(DEPLOY_HOST):$(DEPLOY_DIR)/dist/api/
	rsync -avz --delete $(UI_DIR)/dist/ $(DEPLOY_HOST):$(DEPLOY_DIR)/dist/ui/
	rsync -avz deploy $(DEPLOY_HOST):$(DEPLOY_DIR)/dist/
	rsync -avz Makefile $(wildcard Makefile.local) $(DEPLOY_HOST):$(DEPLOY_DIR)/
	@echo ">>> Done. Restart on the server: cd $(DEPLOY_DIR) && make restart"

##@ Server -- on the server itself, in DEPLOY_DIR (everything it runs lives in dist/)

install-services: ## on the server: install + enable the systemd services from dist/deploy/ (first time, and when they change)
	for s in $(SERVICES); do \
		sed -e 's#@DEPLOY_DIR@#$(DEPLOY_DIR)#g' -e 's#@DEPLOY_USER@#$(DEPLOY_USER)#g' dist/deploy/$$s.service > /tmp/$$s.service \
		&& sudo install -m 644 /tmp/$$s.service /etc/systemd/system/ \
		&& rm /tmp/$$s.service || exit 1; \
	done
	sudo systemctl daemon-reload
	sudo systemctl enable $(SERVICES)
	@$(MAKE) --no-print-directory install-aliases

# One line in ~/.bashrc, added once.
ALIASES_LINE := [ -f $(CURDIR)/dist/deploy/aliases.sh ] && . $(CURDIR)/dist/deploy/aliases.sh
install-aliases: ## on the server: the shortcuts (axeos-help...) at every login
	@grep -qF '$(ALIASES_LINE)' ~/.bashrc 2>/dev/null \
		&& echo ">>> Shortcuts already loaded by ~/.bashrc" \
		|| { echo '$(ALIASES_LINE)' >> ~/.bashrc && echo ">>> Shortcuts added to ~/.bashrc -- new logins have them, or: . ~/.bashrc"; }

restart: ## on the server: restart mailer, feeder and dashboard-api (systemd)
	sudo systemctl restart $(SERVICES)

RELEASE_URL := https://github.com/$(GITHUB_REPO)/releases/$(if $(RELEASE_TAG),download/$(if $(filter latest,$(RELEASE_TAG)),latest,v$(RELEASE_TAG)),latest/download)

# Everything downloaded beside, then swapped: a failed download changes nothing.
# This Makefile and dist/deploy/ come with the release too, so the next update
# runs the release's own; make has read this one already, replacing it is safe.
# The services themselves are installed by install-services (sudo, a
# daemon-reload): only said when they changed.
update: ## on the server: install the last vX.Y.Z release (RELEASE_TAG=1.0.0 / latest for another), then restart
	@echo ">>> Fetching release '$(or $(RELEASE_TAG),the last vX.Y.Z)' from $(GITHUB_REPO) (arch: $(RELEASE_ARCH))..."
	mkdir -p dist/api
	rm -rf dist/ui.new dist/ui.old dist/deploy.new dist/deploy.old Makefile.new
	mkdir dist/ui.new dist/deploy.new
	for bin in $(BINARIES); do curl -fL $(RELEASE_URL)/$$bin-$(RELEASE_ARCH) -o dist/api/$$bin.new || exit 1; done
	curl -fL $(RELEASE_URL)/ui-dist.tar.gz | tar -xz -C dist/ui.new
	test -f dist/ui.new/index.html
	curl -fL $(RELEASE_URL)/deploy.tar.gz | tar -xz -C dist/deploy.new --strip-components=1
	curl -fL $(RELEASE_URL)/Makefile -o Makefile.new
	for bin in $(BINARIES); do chmod +x dist/api/$$bin.new && mv dist/api/$$bin.new dist/api/$$bin || exit 1; done
	if [ -d dist/ui ]; then mv dist/ui dist/ui.old; fi
	mv dist/ui.new dist/ui
	rm -rf dist/ui.old
	@changed=; for s in $(SERVICES); do cmp -s dist/deploy/$$s.service dist/deploy.new/$$s.service || changed=1; done; \
	if [ -d dist/deploy ]; then mv dist/deploy dist/deploy.old; fi; \
	mv dist/deploy.new dist/deploy && rm -rf dist/deploy.old && mv Makefile.new Makefile; \
	if [ -n "$$changed" ]; then echo ">>> The systemd services changed: make install-services, to install them"; fi
	sudo systemctl restart $(SERVICES)

check-config:
	@test -f "$(CONFIG)" || { echo "Error: config file $(CONFIG) not found (CONFIG=...)"; exit 1; }

##@ Releases -- from anywhere

versions: ## the releases on GitHub: latest's commit, then every vX.Y.Z, newest first
	@tags=$$(git ls-remote --tags https://github.com/$(GITHUB_REPO).git) || exit 1; \
	echo "latest    $$(echo "$$tags" | awk '$$2 == "refs/tags/latest" { print substr($$1, 1, 7) }')"; \
	echo "releases  $$(echo "$$tags" | sed -n 's#.*refs/tags/\(v[0-9][^^]*\)$$#\1#p' | sort -rV | paste -sd ' ' -)"
