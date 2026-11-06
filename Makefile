# ==============================================================================
# ⚙️  User Configuration — update these when deploying on a new server
# ==============================================================================

# The server, the only three values to change for yours: its SSH alias, the user
# its services run as, and its folder. `make deploy` copies there,
# `make install-services` writes them into deploy/*.service. Yours go in
# Makefile.local (same lines, not versioned), which `make deploy` copies too. A
# := so a stale one exported in a shell can't send a deploy elsewhere; the
# command line still wins.
DEPLOY_HOST := server-dev
DEPLOY_USER := debian
DEPLOY_DIR  := /home/debian/axeos-bitaxe-dashboard
-include Makefile.local

# Listening port for dashboard-api (must match server.port in CONFIG_FILE)
DASHBOARD_API_PORT ?= 8080

# Path to the configuration file
CONFIG_FILE ?= resources/dashboard.yml

# The UI dev server's port, fixed (--strictPort: a port in use fails rather
# than moving to the next one).
DASHBOARD_UI_PORT ?= 5174

# GitHub repo + release used by `make latest-update` (CI-built binaries for the local architecture instead of building locally)
GITHUB_REPO       ?= joakim-ribier/axeos-dashboard
RELEASE_TAG       ?= latest

# Auto-detected local architecture, used to pick the right release asset
# (feeder-$(RELEASE_ARCH), dashboard-api-$(RELEASE_ARCH), ...). Override if
# `uname -m` reports something unexpected: make latest-update RELEASE_ARCH=amd64
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

# ==============================================================================
# Build Configuration
# ==============================================================================

# Output directory for compiled binaries
SERVER_BUILD_DIR := resources/build/server/bin

# Git SHA baked into each binary (exposed via GET /api/miners as buildSHA) —
# lets you confirm you're running the version you expect, e.g. after `make latest-update`.
GIT_SHA := $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
GIT_DIRTY := $(shell git diff --quiet 2>/dev/null || echo -dirty)
VERSION_LDFLAGS := -ldflags "-X github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version.GitSHA=$(GIT_SHA)$(GIT_DIRTY)"

# ==============================================================================
# Phony Targets (Virtual commands, not actual files)
# ==============================================================================
.PHONY: all build clean help lintAll test swagger run-dashboard-api run-feeder run-mailer run-dashboard-ui rebuild-totals dev-up dev-down install-services restart latest-update run build-ui build-linux deploy docker-build docs-serve

# ==============================================================================
# Main Commands
# ==============================================================================

# Default target: build everything
all: build

# Build all binaries
build:
	@echo ">>> Compiling both projects..."
	@mkdir -p $(SERVER_BUILD_DIR)

	# Build FEEDER binary
	@echo "   - Building feeder..."
	cd server && go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/feeder ./cmd/feeder

	# Build MAILER binary
	@echo "   - Building mailer..."
	cd server && go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/mailer ./cmd/mailer

	# Build DASHBOARD-API binary
	@echo "   - Building dashboard-api..."
	cd server && go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/dashboard-api ./cmd/dashboard-api

	# Build REBUILD-TOTALS binary (one-off tool, not part of the running stack)
	@echo "   - Building rebuild-totals..."
	cd server && go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/rebuild-totals ./cmd/rebuild-totals

	@echo ">>> Success! Binaries available in $(SERVER_BUILD_DIR)/"

# Build the "app" Docker image with the same version stamping as `build`
# (GIT_SHA + GIT_DIRTY) baked in via --build-arg, instead of the
# Dockerfile's own "dev" placeholder -- so a locally built image reports
# which commit it came from, same as a locally built binary does.
docker-build:
	@echo ">>> Building Docker images (GIT_SHA=$(GIT_SHA)$(GIT_DIRTY))..."
	docker compose build --build-arg GIT_SHA=$(GIT_SHA)$(GIT_DIRTY)

# Run linter on all Go packages
lintAll:
	@echo ">>> Running linter on all packages..."
	cd server && golangci-lint run ./...
	@echo ">>> Linting complete."

# Run the Go test suite with race detection and coverage
test:
	@echo ">>> Running Go test suite..."
	cd server && go test ./... -race -cover
	@echo ">>> Tests complete."

# Regenerate the OpenAPI spec from @-annotations in internal/handler and cmd/dashboard-api,
# and refresh the copy the docs site's Redoc page (docs/en/api.md, docs/api.md) reads from.
swagger:
	@echo ">>> Regenerating OpenAPI spec..."
	cd server && go tool swag init -g cmd/dashboard-api/main.go -o docs/swagger --outputTypes json,yaml --parseInternal
	cp server/docs/swagger/swagger.json docs/assets/api/swagger.json
	@echo ">>> Done. See server/docs/swagger/swagger.yaml and docs/assets/api/swagger.json"

# Serve the docs site (GitHub Pages / Jekyll) locally, with live rebuild
docs-serve:
	@echo ">>> Starting Jekyll docs server..."
	cd docs && jekyll serve

# Clean build artifacts
clean:
	@echo ">>> Cleaning $(SERVER_BUILD_DIR)..."
	rm -rf $(SERVER_BUILD_DIR)
	@echo ">>> Done."

# Run dashboard-api with the specified configuration file
run-dashboard-api:
	@echo ">>> Starting dashboard-api with config: $(CONFIG_FILE)..."
	@if [ ! -f "$(CONFIG_FILE)" ]; then echo "Error: Config file $(CONFIG_FILE) not found."; exit 1; fi
	@$(SERVER_BUILD_DIR)/dashboard-api -config $(CONFIG_FILE)

# Run feeder with the specified configuration file
run-feeder:
	@echo ">>> Starting feeder with config: $(CONFIG_FILE)..."
	@if [ ! -f "$(CONFIG_FILE)" ]; then echo "Error: Config file $(CONFIG_FILE) not found."; exit 1; fi
	@$(SERVER_BUILD_DIR)/feeder -config $(CONFIG_FILE)

# Run mailer (scheduled mails: the audit report) with the specified configuration file
run-mailer:
	@echo ">>> Starting mailer with config: $(CONFIG_FILE)..."
	@if [ ! -f "$(CONFIG_FILE)" ]; then echo "Error: Config file $(CONFIG_FILE) not found."; exit 1; fi
	@$(SERVER_BUILD_DIR)/mailer -config $(CONFIG_FILE)

# Reconstruct totals.json (persistent, reboot-surviving uptime/shares/
# electricity-cost counters) from each miner's full JSONL history. Safe by
# default: DRY_RUN=1 unless overridden, and the tool itself backs up any
# existing totals.json before overwriting it. Examples:
#   make rebuild-totals                              # dry-run, all miners
#   make rebuild-totals MINER=aabbccddeeff            # dry-run, one miner
#   make rebuild-totals MINER=aabbccddeeff DRY_RUN=   # write it for real, one miner
#   make rebuild-totals DRY_RUN=                      # write it for real, all miners
#   make rebuild-totals DRY_RUN= FALLBACK_RATE=0.15   # ...billing pre-tracking polls at €0.15/kWh instead of today's configured rate
DRY_RUN ?= 1
MINER ?=
FALLBACK_RATE ?=
DRY_RUN_FLAG = $(if $(DRY_RUN),-dry-run=true,-dry-run=false)
MINER_FLAG = $(if $(MINER),-miner $(MINER),)
FALLBACK_RATE_FLAG = $(if $(FALLBACK_RATE),-fallback-rate $(FALLBACK_RATE),)
rebuild-totals:
	@echo ">>> Backfilling totals.json (config: $(CONFIG_FILE))..."
	@if [ ! -f "$(CONFIG_FILE)" ]; then echo "Error: Config file $(CONFIG_FILE) not found."; exit 1; fi
	@$(SERVER_BUILD_DIR)/rebuild-totals -config $(CONFIG_FILE) $(DRY_RUN_FLAG) $(MINER_FLAG) $(FALLBACK_RATE_FLAG)

# Run UI dev server → dashboard-api
run-dashboard-ui:
	@echo ">>> Starting UI dev server → dashboard-api (:$(DASHBOARD_API_PORT))..."
	@if [ ! -d "ui" ]; then echo "Error: UI directory not found."; exit 1; fi
	cd ui && API_PORT=$(DASHBOARD_API_PORT) npm run dev -- --port $(DASHBOARD_UI_PORT) --strictPort

# ==============================================================================
# Dev Environment (UI + APIs via screen)
# ==============================================================================

SCREEN_NAME := axeos-dashboard
ROOT_DIR := $(shell pwd)
UI_DIR := ui

# Start full development environment with all services in a screen session
dev-up: build
	@echo "🚀 Starting full dev environment..."

	# Quit old session if it exists
	- screen -S $(SCREEN_NAME) -X quit 2>/dev/null || true
	@sleep 1

	# Create new screen session
	screen -dmS $(SCREEN_NAME)

	# --- DASHBOARD UI ---
	screen -S $(SCREEN_NAME) -X screen -t dashboard-ui bash -c "\
		cd $(UI_DIR) && \
		API_PORT=$(DASHBOARD_API_PORT) npm run dev -- --host 0.0.0.0 --port $(DASHBOARD_UI_PORT) --strictPort"

	# --- DASHBOARD API ---
	screen -S $(SCREEN_NAME) -X screen -t dashboard-api bash -c "\
		cd $(ROOT_DIR) && \
		$(SERVER_BUILD_DIR)/dashboard-api -config $(CONFIG_FILE)"

	# --- FEEDER ---
	screen -S $(SCREEN_NAME) -X screen -t feeder bash -c "\
		cd $(ROOT_DIR) && \
		$(SERVER_BUILD_DIR)/feeder -config $(CONFIG_FILE)"

	# --- MAILER ---
	screen -S $(SCREEN_NAME) -X screen -t mailer bash -c "\
		cd $(ROOT_DIR) && \
		$(SERVER_BUILD_DIR)/mailer -config $(CONFIG_FILE)"

	@echo "✅ Dev environment started. Use 'screen -r $(SCREEN_NAME)' to connect."

# Stop development environment and all associated processes
dev-down:
	@echo "🛑 Stopping dev environment..."

	# 1. Kill the entire screen session (kills all child processes)
	- screen -S $(SCREEN_NAME) -X quit 2>/dev/null || true
	@sleep 1

	# 2. Kill residual processes by name (fallback) -- this stack's only
	-pkill -9 -f -- "--port $(DASHBOARD_UI_PORT)" 2>/dev/null || true
	-pkill -9 -f "npm run preview" 2>/dev/null || true
	-pkill -9 -f "$(SERVER_BUILD_DIR)/dashboard-api" 2>/dev/null || true
	-pkill -9 -f "feeder" 2>/dev/null || true
	-pkill -9 -f "mailer" 2>/dev/null || true

	# 3. Clean up zombie screen sessions
	-screen -wipe > /dev/null 2>&1 || true

	@echo "✅ Stopped"

# dashboard-api + its UI on :$(DASHBOARD_UI_PORT) together in this console, each
# line prefixed with where it comes from; Ctrl+C stops both. No feeder, no mailer.
run: build
	@trap 'kill 0' INT TERM; \
	$(SERVER_BUILD_DIR)/dashboard-api -config $(CONFIG_FILE) 2>&1 | sed -l 's/^/[api] /' & \
	(cd $(UI_DIR) && API_PORT=$(DASHBOARD_API_PORT) npm run dev -- --port $(DASHBOARD_UI_PORT) --strictPort) 2>&1 | sed -l 's/^/[ui]  /' & \
	wait

# ==============================================================================
# The server: everything it runs lives in dist/, next to this Makefile -- dist/api,
# dist/ui, dist/deploy -- as one systemd service per process, no screen.
# Run these there.
# ==============================================================================

SERVICES := axeos-dashboard-api axeos-dashboard-feeder axeos-dashboard-mailer
BINARIES := dashboard-api feeder mailer rebuild-totals
RELEASE_URL := https://github.com/$(GITHUB_REPO)/releases/download/$(RELEASE_TAG)

install-services:
	for s in $(SERVICES); do \
		sed -e 's#@DEPLOY_DIR@#$(DEPLOY_DIR)#g' -e 's#@DEPLOY_USER@#$(DEPLOY_USER)#g' dist/deploy/$$s.service > /tmp/$$s.service \
		&& sudo install -m 644 /tmp/$$s.service /etc/systemd/system/ \
		&& rm /tmp/$$s.service || exit 1; \
	done
	sudo systemctl daemon-reload
	sudo systemctl enable $(SERVICES)

restart:
	sudo systemctl restart $(SERVICES)

# Downloaded beside, then swapped: a failed download changes nothing.
latest-update:
	@echo ">>> Fetching release '$(RELEASE_TAG)' from $(GITHUB_REPO) (arch: $(RELEASE_ARCH))..."
	mkdir -p dist/api
	rm -rf dist/ui.new dist/ui.old
	mkdir dist/ui.new
	for bin in $(BINARIES); do curl -fL $(RELEASE_URL)/$$bin-$(RELEASE_ARCH) -o dist/api/$$bin.new || exit 1; done
	curl -fL $(RELEASE_URL)/ui-dist.tar.gz | tar -xz -C dist/ui.new
	test -f dist/ui.new/index.html
	for bin in $(BINARIES); do chmod +x dist/api/$$bin.new && mv dist/api/$$bin.new dist/api/$$bin || exit 1; done
	if [ -d dist/ui ]; then mv dist/ui dist/ui.old; fi
	mv dist/ui.new dist/ui
	rm -rf dist/ui.old
	sudo systemctl restart $(SERVICES)

# ==============================================================================
# Deploy (a local build, run from your machine, for trying out a change on the
# real server without pushing to main or waiting on CI: dist/ and this Makefile.
# Nothing is restarted: `make restart` on the server afterwards.)
# ==============================================================================

build-ui:
	@echo ">>> Building UI..."
	cd $(UI_DIR) && npm run build
	@echo ">>> Done. Static files: ui/dist"

# Cross-compile dashboard-api + feeder + mailer for the Pi (linux/arm64) and build the UI.
build-linux: build-ui
	@echo ">>> Cross-compiling dashboard-api + feeder + mailer + rebuild-totals for linux/arm64..."
	@mkdir -p $(SERVER_BUILD_DIR)
	cd server && GOOS=linux GOARCH=arm64 go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/dashboard-api ./cmd/dashboard-api
	cd server && GOOS=linux GOARCH=arm64 go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/feeder ./cmd/feeder
	cd server && GOOS=linux GOARCH=arm64 go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/mailer ./cmd/mailer
	cd server && GOOS=linux GOARCH=arm64 go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/rebuild-totals ./cmd/rebuild-totals
	@echo ">>> Done."

deploy: build-linux
	@echo ">>> Copying the binaries, the UI, deploy/ and this Makefile to $(DEPLOY_HOST):$(DEPLOY_DIR)..."
	ssh $(DEPLOY_HOST) "mkdir -p $(DEPLOY_DIR)/dist/api $(DEPLOY_DIR)/dist/ui"
	rsync -avz $(BINARIES:%=$(SERVER_BUILD_DIR)/%) $(DEPLOY_HOST):$(DEPLOY_DIR)/dist/api/
	rsync -avz --delete $(UI_DIR)/dist/ $(DEPLOY_HOST):$(DEPLOY_DIR)/dist/ui/
	rsync -avz deploy $(DEPLOY_HOST):$(DEPLOY_DIR)/dist/
	rsync -avz Makefile $(wildcard Makefile.local) $(DEPLOY_HOST):$(DEPLOY_DIR)/
	@echo ">>> Done. Restart on the server: cd $(DEPLOY_DIR) && make restart"

# Display help message
help:
	@echo "Available commands:"
	@echo "  make build                     - Compile feeder, mailer, dashboard-api and rebuild-totals"
	@echo "  make lintAll                   - Run linter on all packages"
	@echo "  make swagger                   - Regenerate the OpenAPI spec (server/docs/swagger/)"
	@echo "  make docs-serve                - Serve the docs site locally (cd docs && jekyll serve)"
	@echo "  make clean                     - Remove generated binaries"
	@echo "  make docker-build               - Build the Docker images locally with the real git SHA baked in (docker compose build)"
	@echo "  make run-dashboard-api         - Start dashboard-api with resources/dashboard.yml"
	@echo "  make run-feeder                - Start feeder with resources/dashboard.yml"
	@echo "  make run-mailer                - Start mailer (scheduled mails) with resources/dashboard.yml"
	@echo "  make rebuild-totals           - Reconstruct totals.json from JSONL history (dry-run by default; DRY_RUN= to write, MINER= to target one miner)"
	@echo "  make run-dashboard-ui          - Start UI dev server → dashboard-api (:$(DASHBOARD_API_PORT))"
	@echo "  make dev-up                    - Start full dev environment (UI + dashboard-api + feeder + mailer)"
	@echo "  make dev-down                  - Stop dev environment"
	@echo "  make run                       - dashboard-api + its UI (:$(DASHBOARD_UI_PORT)) in this console, no feeder/mailer -- Ctrl+C stops both"
	@echo "  make install-services          - (run on the server) install the systemd services from dist/deploy/"
	@echo "  make restart                   - (run on the server) restart dashboard-api + feeder + mailer"
	@echo "  make latest-update             - (run on the server) update from the latest GitHub Release (auto-detects arch) and restart"
	@echo "  make build-ui                  - Build the UI (static files in ui/dist) -- the same for a dashboard and a board"
	@echo "  make build-linux               - Cross-compile dashboard-api/feeder/mailer/rebuild-totals (linux/arm64) and build the UI"
	@echo "  make deploy                    - build-linux, then copy the result to $(DEPLOY_HOST) (test without pushing to main)"
	@echo "  make help                      - Show this help message"
