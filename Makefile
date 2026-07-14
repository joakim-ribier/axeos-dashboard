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

# ==============================================================================
# Build Configuration
# ==============================================================================

# Output directory for compiled binaries
SERVER_BUILD_DIR := resources/build/server/bin

# ==============================================================================
# Phony Targets (Virtual commands, not actual files)
# ==============================================================================
.PHONY: all build clean help lintAll run-dashboard-api run-feeder run-remote-dashboard-api run-dashboard-ui run-remote-dashboard-ui dev-up dev-down dev-attach dev-status dev-logs dev-up-remote dev-down-remote

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
	cd server && go build -o ../$(SERVER_BUILD_DIR)/feeder ./cmd/feeder

	# Build DASHBOARD-API binary
	@echo "   - Building dashboard-api..."
	cd server && go build -o ../$(SERVER_BUILD_DIR)/dashboard-api ./cmd/dashboard-api

	# Build REMOTE-DASHBOARD-API binary
	@echo "   - Building remote-dashboard-api..."
	cd server && go build -o ../$(SERVER_BUILD_DIR)/remote-dashboard-api ./cmd/remote-dashboard-api

	@echo ">>> Success! Binaries available in $(SERVER_BUILD_DIR)/"

# Run linter on all Go packages
lintAll:
	@echo ">>> Running linter on all packages..."
	cd server && golangci-lint run ./...
	@echo ">>> Linting complete."

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

# Start remote-dashboard-api in a screen session (VPS use)
dev-up-remote: build
	- screen -S $(SCREEN_NAME) -X quit 2>/dev/null || true
	@sleep 1
	screen -dmS $(SCREEN_NAME)
	screen -S $(SCREEN_NAME) -X screen -t remote-dashboard-api bash -c "\
		cd $(ROOT_DIR) && \
		$(SERVER_BUILD_DIR)/remote-dashboard-api -config $(CONFIG_FILE); exec bash"
	@echo ">>> remote-dashboard-api started in screen '$(SCREEN_NAME)'"
	@echo ">>> Attach: make dev-attach"

dev-down-remote:
	- screen -S $(SCREEN_NAME) -X quit 2>/dev/null || true
	-pkill -9 -f "remote-dashboard-api" 2>/dev/null || true
	-screen -wipe > /dev/null 2>&1 || true
	@echo ">>> Stopped."

# Stop development environment and all associated processes
dev-down:
	@echo "🛑 Stopping dev environment..."

	# 1. Kill the entire screen session (kills all child processes)
	- screen -S $(SCREEN_NAME) -X quit 2>/dev/null || true
	@sleep 1

	# 2. Kill residual processes by name (fallback)
	-pkill -9 -f "npm run dev" 2>/dev/null || true
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
