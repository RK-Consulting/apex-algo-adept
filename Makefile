# ============================================================
# Apex Algo Adept — Authoritative Build, Verify & Deploy
# ============================================================

.DEFAULT_GOAL := help
SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c

# ------------------------------------------------------------
# Directories
# ------------------------------------------------------------
BACKEND_DIR := backend
SCRIPTS_DIR := scripts
DB_SCRIPTS  := $(SCRIPTS_DIR)/db
ICICI_SCRIPTS := $(SCRIPTS_DIR)/icici
ENV_SCRIPTS := $(SCRIPTS_DIR)/env
LOG_DIR := logs

# ------------------------------------------------------------
# Environment
# ------------------------------------------------------------
NODE_ENV ?= production
export NODE_ENV
ENV_FILE := $(BACKEND_DIR)/.env

# ------------------------------------------------------------
# Colors
# ------------------------------------------------------------
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

# ------------------------------------------------------------
# Help
# ------------------------------------------------------------
.PHONY: help
help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Core:"
	@echo "  make install        Install dependencies"
	@echo "  make preflight      Run ALL sanity checks (HARD GATE)"
	@echo "  make build          Compile backend"
	@echo "  make test           Run tests"
	@echo ""
	@echo "Database:"
	@echo "  make db-verify      Verify DB + FSM invariants"
	@echo "  make db-migrate     Run migrations"
	@echo ""
	@echo "ICICI:"
	@echo "  make icici-verify   Verify ICICI FSM & guard invariants"
	@echo ""
	@echo "Deploy:"
	@echo "  make deploy-prod    Production deploy"
	@echo ""

# ------------------------------------------------------------
# Permissions (DECLARATIVE — NO MANUAL CHMOD EVER)
# ------------------------------------------------------------
.PHONY: set-permissions
set-permissions:
	@echo "$(GREEN)Enforcing script permissions$(NC)"
	@find $(SCRIPTS_DIR) -type f -name "*.sh" -exec chmod +x {} \;

# ------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------
.PHONY: install
install:
	@echo "$(GREEN)Installing backend dependencies$(NC)"
	cd $(BACKEND_DIR) && npm ci

# ------------------------------------------------------------
# Environment
# ------------------------------------------------------------
.PHONY: env-verify
env-verify:
	@echo "$(GREEN)Verifying environment variables$(NC)"
	@set -a && source $(ENV_FILE) && set +a && bash $(ENV_SCRIPTS)/verify-env.sh

# ------------------------------------------------------------
# Database
# ------------------------------------------------------------
.PHONY: db-verify
db-verify:
	@echo "$(GREEN)Verifying database integrity$(NC)"
	@set -a && source $(ENV_FILE) && set +a && bash $(DB_SCRIPTS)/verify-db-12-2025.sh

.PHONY: db-migrate
db-migrate: db-verify
	@echo "$(GREEN)Running database migrations$(NC)"
	@set -a && source $(ENV_FILE) && set +a && bash $(DB_SCRIPTS)/migrate.sh

# ------------------------------------------------------------
# ICICI
# ------------------------------------------------------------
.PHONY: icici-verify
icici-verify:
	@echo "$(GREEN)Verifying ICICI FSM & guard invariants$(NC)"
	@set -a && source $(ENV_FILE) && set +a && bash $(ICICI_SCRIPTS)/verify-guard-12-2025.sh

# ------------------------------------------------------------
# Preflight (HARD GATE — NOTHING PASSES WITHOUT THIS)
# ------------------------------------------------------------
.PHONY: preflight
preflight: set-permissions env-verify db-verify icici-verify
	@echo "$(GREEN)ALL PREFLIGHT CHECKS PASSED$(NC)"

# ------------------------------------------------------------
# Build
# ------------------------------------------------------------
.PHONY: clean
clean:
	@echo "$(YELLOW)Cleaning build artifacts$(NC)"
	rm -rf $(BACKEND_DIR)/dist

.PHONY: build
build: preflight install clean
	@echo "$(GREEN)Building backend$(NC)"
	cd $(BACKEND_DIR) && npm run build

# ------------------------------------------------------------
# Testing
# ------------------------------------------------------------
.PHONY: test
test:
	@cd $(BACKEND_DIR) && npm test

# ------------------------------------------------------------
# Deployment
# ------------------------------------------------------------
.PHONY: deploy-prod
deploy-prod: build test
	@echo "$(GREEN)Deploying to production$(NC)"
	bash $(SCRIPTS_DIR)/deploy/deploy-prod.sh
