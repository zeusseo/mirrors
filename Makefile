.PHONY: help install \
       build build-all build-core build-transporter build-ui \
       dev relay start stop \
       lint lint-core lint-transporter lint-ui check \
       test test-core test-transporter \
       clean rebuild

PID_DIR := .pids

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Setup ───────────────────────────────────────────────────────

install: ## Install all dependencies
	yarn install
	cd server && npm install

# ─── Build ───────────────────────────────────────────────────────

build: build-core build-transporter ## Build core + transporter (ordered)

build-all: build build-ui ## Build all packages (core → transporter → ui)

build-core: ## Build @syncit/core
	cd packages/core && yarn build && yarn typings

build-transporter: build-core ## Build @syncit/transporter (depends on core)
	cd packages/transporter && yarn build

build-ui: build ## Build @syncit/ui (depends on core + transporter)
	cd packages/ui && yarn build

# ─── Development ─────────────────────────────────────────────────

dev: ## Start UI dev server (http://localhost:5173)
	cd packages/ui && yarn dev

relay: ## Start Socket.IO relay server (port 3100)
	cd server && node socketio-relay.js

start: ## Start both relay server and UI dev server
	@mkdir -p $(PID_DIR)
	@echo "Starting Socket.IO relay server..."
	@cd server && node socketio-relay.js & echo $$! > $(PID_DIR)/relay.pid
	@sleep 1
	@echo "Starting UI dev server..."
	@cd packages/ui && yarn dev & echo $$! > $(PID_DIR)/dev.pid
	@wait

stop: ## Stop dev and relay servers
	@if [ -f $(PID_DIR)/relay.pid ]; then \
		kill $$(cat $(PID_DIR)/relay.pid) 2>/dev/null; \
		rm -f $(PID_DIR)/relay.pid; \
	fi
	@if [ -f $(PID_DIR)/dev.pid ]; then \
		kill $$(cat $(PID_DIR)/dev.pid) 2>/dev/null; \
		rm -f $(PID_DIR)/dev.pid; \
	fi
	@-pkill -f "socketio-relay" 2>/dev/null; true
	@-pkill -f "vite dev" 2>/dev/null; true
	@echo "Servers stopped."

# ─── Lint & Check ────────────────────────────────────────────────

lint: lint-core lint-transporter lint-ui ## Run linters on all packages

lint-core: ## Lint @syncit/core
	cd packages/core && npx eslint src/

lint-transporter: ## Lint @syncit/transporter
	cd packages/transporter && npx eslint src/

lint-ui: ## Lint @syncit/ui
	cd packages/ui && yarn lint

check: ## Type-check all packages
	lerna run check

# ─── Test ────────────────────────────────────────────────────────

test: ## Run all tests
	lerna run test

test-core: ## Run core tests
	cd packages/core && yarn test

test-transporter: ## Run transporter tests
	cd packages/transporter && yarn test

# ─── Clean ───────────────────────────────────────────────────────

clean: ## Remove build artifacts
	rm -rf packages/core/lib packages/core/es packages/core/dist packages/core/typings
	rm -rf packages/transporter/lib packages/transporter/es packages/transporter/dist packages/transporter/typings
	rm -rf packages/ui/dist
	rm -rf $(PID_DIR)

rebuild: clean build ## Clean and rebuild all packages
