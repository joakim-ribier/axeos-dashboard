# ==============================================================================
# ⚙️  User Configuration — update these when deploying on a new server
# ==============================================================================

# Listening port for dashboard-api (must match server.port in CONFIG_FILE)
DASHBOARD_API_PORT ?= 8080

# Listening port for remote-dashboard-api (must match server.port in REMOTE_DASHBOARD_CONFIG)
REMOTE_DASHBOARD_API_PORT ?= 8081

# Path to the configuration file
CONFIG_FILE ?= resources/dashboard.yml

# Config for remote-dashboard-api (minimal: storage + pools only)
REMOTE_DASHBOARD_CONFIG ?= resources/remote-dashboard.yml

# Optional path to a separate miners config file (not committed to git)
# Override on server: make dev-up MINERS_FILE=/path/to/miners.yml
MINERS_FILE ?= resources/miners.yml
MINERS_FLAG = $(if $(MINERS_FILE),-miners $(MINERS_FILE),)

# GitHub repo + release used by `make latest-*` (fetch CI-built binaries for the local architecture instead of building locally)
GITHUB_REPO       ?= joakim-ribier/axeos-dashboard
RELEASE_TAG       ?= latest

# Auto-detected local architecture, used to pick the right release asset
# (feeder-$(RELEASE_ARCH), dashboard-api-$(RELEASE_ARCH), ...). Override if
# `uname -m` reports something unexpected: make latest-fetch RELEASE_ARCH=amd64
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
# lets you confirm you're running the version you expect, e.g. after `make latest-up`.
GIT_SHA := $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
GIT_DIRTY := $(shell git diff --quiet 2>/dev/null || echo -dirty)
VERSION_LDFLAGS := -ldflags "-X github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version.GitSHA=$(GIT_SHA)$(GIT_DIRTY)"

# ==============================================================================
# Phony Targets (Virtual commands, not actual files)
# ==============================================================================
.PHONY: all build clean help lintAll test swagger run-dashboard-api run-feeder run-remote-dashboard-api run-dashboard-ui run-remote-dashboard-ui dev-up dev-down dev-attach dev-status dev-logs latest-fetch latest-up latest-down latest-remote-up latest-remote-down

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

	# Build DASHBOARD-API binary
	@echo "   - Building dashboard-api..."
	cd server && go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/dashboard-api ./cmd/dashboard-api

	# Build REMOTE-DASHBOARD-API binary
	@echo "   - Building remote-dashboard-api..."
	cd server && go build $(VERSION_LDFLAGS) -o ../$(SERVER_BUILD_DIR)/remote-dashboard-api ./cmd/remote-dashboard-api

	@echo ">>> Success! Binaries available in $(SERVER_BUILD_DIR)/"

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

# Regenerate the OpenAPI spec from @-annotations in internal/handler and cmd/dashboard-api.
swagger:
	@echo ">>> Regenerating OpenAPI spec..."
	cd server && go tool swag init -g cmd/dashboard-api/main.go -o docs/swagger --outputTypes json,yaml --parseInternal
	@echo ">>> Done. See server/docs/swagger/swagger.yaml"

# Clean build artifacts
clean:
	@echo ">>> Cleaning $(SERVER_BUILD_DIR)..."
	rm -rf $(SERVER_BUILD_DIR)
	@echo ">>> Done."

# Run dashboard-api with the specified configuration file
run-dashboard-api:
	@echo ">>> Starting dashboard-api with config: $(CONFIG_FILE)..."
	@if [ ! -f "$(CONFIG_FILE)" ]; then echo "Error: Config file $(CONFIG_FILE) not found."; exit 1; fi
	@$(SERVER_BUILD_DIR)/dashboard-api -config $(CONFIG_FILE) $(MINERS_FLAG)

# Run feeder with the specified configuration file
run-feeder:
	@echo ">>> Starting feeder with config: $(CONFIG_FILE)..."
	@if [ ! -f "$(CONFIG_FILE)" ]; then echo "Error: Config file $(CONFIG_FILE) not found."; exit 1; fi
	@$(SERVER_BUILD_DIR)/feeder -config $(CONFIG_FILE) $(MINERS_FLAG)

# Run remote-dashboard-api (read-only) with remote-dashboard.yml
run-remote-dashboard-api:
	@echo ">>> Starting remote-dashboard-api with config: $(REMOTE_DASHBOARD_CONFIG)..."
	@if [ ! -f "$(REMOTE_DASHBOARD_CONFIG)" ]; then echo "Error: Config file $(REMOTE_DASHBOARD_CONFIG) not found."; exit 1; fi
	@$(SERVER_BUILD_DIR)/remote-dashboard-api -config $(REMOTE_DASHBOARD_CONFIG)

# Run UI dev server → dashboard-api
run-dashboard-ui:
	@echo ">>> Starting UI dev server → dashboard-api (:$(DASHBOARD_API_PORT))..."
	@if [ ! -d "ui" ]; then echo "Error: UI directory not found."; exit 1; fi
	cd ui && API_PORT=$(DASHBOARD_API_PORT) npm run dev

# Run UI dev server → remote-dashboard-api
run-remote-dashboard-ui:
	@echo ">>> Starting UI dev server → remote-dashboard-api (:$(REMOTE_DASHBOARD_API_PORT))..."
	@if [ ! -d "ui" ]; then echo "Error: UI directory not found."; exit 1; fi
	cd ui && API_PORT=$(REMOTE_DASHBOARD_API_PORT) npm run dev

# Display help message
help:
	@echo "Available commands:"
	@echo "  make build                     - Compile feeder, dashboard-api and remote-dashboard-api"
	@echo "  make lintAll                   - Run linter on all packages"
	@echo "  make swagger                   - Regenerate the OpenAPI spec (server/docs/swagger/)"
	@echo "  make clean                     - Remove generated binaries"
	@echo "  make run-dashboard-api         - Start dashboard-api with resources/dashboard.yml"
	@echo "  make run-feeder                - Start feeder with resources/dashboard.yml"
	@echo "  make run-remote-dashboard-api  - Start remote-dashboard-api with resources/remote-dashboard.yml"
	@echo "  make run-dashboard-ui          - Start UI dev server → dashboard-api (:$(DASHBOARD_API_PORT))"
	@echo "  make run-remote-dashboard-ui   - Start UI dev server → remote-dashboard-api (:$(REMOTE_DASHBOARD_API_PORT))"
	@echo "  make dev-up                    - Start full dev environment (UI + dashboard-api + feeder)"
	@echo "  make dev-down                  - Stop dev environment"
	@echo "  make dev-attach                - Attach to existing dev screen session"
	@echo "  make dev-status                - List all screen sessions"
	@echo "  make latest-fetch              - Fetch prebuilt binaries + UI from the latest GitHub Release (auto-detects arch)"
	@echo "  make latest-up                 - Start the stack from the latest release, no local build"
	@echo "  make latest-down               - Stop the latest environment (same as dev-down)"
	@echo "  make latest-remote-up          - Start remote-dashboard-api from the latest release (VPS use, no local build)"
	@echo "  make latest-remote-down        - Stop remote-dashboard-api"
	@echo "  make help                      - Show this help message"

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
		API_PORT=$(DASHBOARD_API_PORT) npm run dev -- --host 0.0.0.0"

	# --- DASHBOARD API ---
	screen -S $(SCREEN_NAME) -X screen -t dashboard-api bash -c "\
		cd $(ROOT_DIR) && \
		$(SERVER_BUILD_DIR)/dashboard-api -config $(CONFIG_FILE) $(MINERS_FLAG)"

	# --- FEEDER ---
	screen -S $(SCREEN_NAME) -X screen -t feeder bash -c "\
		cd $(ROOT_DIR) && \
		$(SERVER_BUILD_DIR)/feeder -config $(CONFIG_FILE) $(MINERS_FLAG)"

	@echo "✅ Dev environment started. Use 'make dev-attach' to connect."

# Stop development environment and all associated processes
dev-down:
	@echo "🛑 Stopping dev environment..."

	# 1. Kill the entire screen session (kills all child processes)
	- screen -S $(SCREEN_NAME) -X quit 2>/dev/null || true
	@sleep 1

	# 2. Kill residual processes by name (fallback)
	-pkill -9 -f "npm run dev" 2>/dev/null || true
	-pkill -9 -f "npm run preview" 2>/dev/null || true
	-pkill -9 -f "dashboard-api" 2>/dev/null || true
	-pkill -9 -f "feeder" 2>/dev/null || true

	# 3. Clean up zombie screen sessions
	-screen -wipe > /dev/null 2>&1 || true

	@echo "✅ Stopped"

# Attach to existing screen session
dev-attach:
	screen -r $(SCREEN_NAME)

# List all screen sessions
dev-status:
	screen -ls

# Display logs message
dev-logs:
	@echo "Logs available in the screen session. Use 'make dev-attach' to connect."

# ==============================================================================
# Latest Environment (prebuilt CI artifacts — no local build, linux/arm64 only)
# ==============================================================================

# Fetch feeder/dashboard-api/remote-dashboard-api binaries + UI dist from the
# latest GitHub Release (built by CI on every push to main).
latest-fetch:
	@echo ">>> Fetching release '$(RELEASE_TAG)' from $(GITHUB_REPO) (arch: $(RELEASE_ARCH))..."
	@curl -sf https://api.github.com/repos/$(GITHUB_REPO)/releases/tags/$(RELEASE_TAG) -o /tmp/axeos-release.json || \
		{ echo "Error: could not fetch release metadata (bad repo or tag?)."; exit 1; }
	@mkdir -p $(SERVER_BUILD_DIR)
	@for bin in feeder dashboard-api remote-dashboard-api; do \
		asset="$$bin-$(RELEASE_ARCH)"; \
		url=$$(jq -r ".assets[] | select(.name==\"$$asset\") | .browser_download_url" /tmp/axeos-release.json); \
		if [ -z "$$url" ] || [ "$$url" = "null" ]; then \
			echo "Error: no '$$asset' asset in release '$(RELEASE_TAG)' — unsupported architecture?"; \
			exit 1; \
		fi; \
		echo "   - $$asset -> $(SERVER_BUILD_DIR)/$$bin"; \
		curl -sfL "$$url" -o $(SERVER_BUILD_DIR)/$$bin; \
		chmod +x $(SERVER_BUILD_DIR)/$$bin; \
	done
	@ui_url=$$(jq -r '.assets[] | select(.name=="ui-dist.tar.gz") | .browser_download_url' /tmp/axeos-release.json); \
	echo "   - ui-dist.tar.gz"; \
	rm -rf $(UI_DIR)/dist && mkdir -p $(UI_DIR)/dist; \
	curl -sfL "$$ui_url" | tar -xz -C $(UI_DIR)/dist
	@echo ">>> Fetched: $(SERVER_BUILD_DIR)/{feeder,dashboard-api,remote-dashboard-api}, $(UI_DIR)/dist/"

# Start the full stack from the latest CI-built release — no local build/toolchain
# needed. The UI (fetched static files in ui/dist) is served by nginx, configured
# once outside of this Makefile — see README's Production Deployment section.
latest-up: latest-fetch
	@echo "🚀 Starting latest environment (prebuilt from CI, no local build)..."

	- screen -S $(SCREEN_NAME) -X quit 2>/dev/null || true
	@sleep 1

	screen -dmS $(SCREEN_NAME)

	# --- DASHBOARD API ---
	screen -S $(SCREEN_NAME) -X screen -t dashboard-api bash -c "\
		cd $(ROOT_DIR) && \
		$(SERVER_BUILD_DIR)/dashboard-api -config $(CONFIG_FILE) $(MINERS_FLAG)"

	# --- FEEDER ---
	screen -S $(SCREEN_NAME) -X screen -t feeder bash -c "\
		cd $(ROOT_DIR) && \
		$(SERVER_BUILD_DIR)/feeder -config $(CONFIG_FILE) $(MINERS_FLAG)"

	@echo "✅ Latest environment started (dashboard-api + feeder). nginx serves the UI separately."
	@echo "   Use 'make dev-attach' to connect to the screen session."

# Stop the latest environment — identical teardown to dev-down (same screen session name).
latest-down: dev-down

# Start remote-dashboard-api from the latest CI-built release (VPS use) — no local
# Go/Node toolchain needed on the server at all.
latest-remote-up: latest-fetch
	- screen -S $(SCREEN_NAME) -X quit 2>/dev/null || true
	@sleep 1
	screen -dmS $(SCREEN_NAME)
	screen -S $(SCREEN_NAME) -X screen -t remote-dashboard-api bash -c "\
		cd $(ROOT_DIR) && \
		$(SERVER_BUILD_DIR)/remote-dashboard-api -config $(CONFIG_FILE); exec bash"
	@echo ">>> remote-dashboard-api started in screen '$(SCREEN_NAME)'"
	@echo ">>> Attach: make dev-attach"

# Stop the latest remote environment.
latest-remote-down:
	- screen -S $(SCREEN_NAME) -X quit 2>/dev/null || true
	-pkill -9 -f "remote-dashboard-api" 2>/dev/null || true
	-screen -wipe > /dev/null 2>&1 || true
	@echo ">>> Stopped."
