# ============================================================
# Apex Algo Adept — Authoritative Build, Verify & Deploy
# ============================================================

.DEFAULT_GOAL := help
.SHELL := /usr/bin/env bash
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
ENV_FILE := backend/.env

export-env:
	@echo "Loading environment from $(ENV_FILE)"
	@set -a && . $(ENV_FILE) && set +a

db-verify: export-env
	bash scripts/db/verify-db-12-2025.sh

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
set-permissions:
	@echo "$(GREEN)Enforcing script permissions$(NC)"
	@find $(SCRIPTS_DIR) -type f -name "*.sh" -exec chmod +x {} \;

# ------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------
install:
	@echo "$(GREEN)Installing backend dependencies$(NC)"
	cd $(BACKEND_DIR) && npm ci

# ------------------------------------------------------------
# Environment
# ------------------------------------------------------------
env-verify:
	@echo "$(GREEN)Verifying environment variables$(NC)"
	bash $(ENV_SCRIPTS)/verify-env.sh

# ------------------------------------------------------------
# Database
# ------------------------------------------------------------
db-verify:
	@echo "$(GREEN)Verifying database integrity$(NC)"
	bash $(DB_SCRIPTS)/verify-db-12-2025.sh

db-migrate: db-verify
	@echo "$(GREEN)Running database migrations$(NC)"
	bash $(DB_SCRIPTS)/migrate.sh

# ------------------------------------------------------------
# ICICI
# ------------------------------------------------------------
icici-verify:
	@echo "$(GREEN)Verifying ICICI FSM & guard invariants$(NC)"
	bash $(ICICI_SCRIPTS)/verify-guard-12-2025.sh

# ------------------------------------------------------------
# Preflight (HARD GATE — NOTHING PASSES WITHOUT THIS)
# ------------------------------------------------------------
preflight: set-permissions env-verify db-verify icici-verify
	@echo "$(GREEN)ALL PREFLIGHT CHECKS PASSED$(NC)"

# ------------------------------------------------------------
# Build
# ------------------------------------------------------------
clean:
	@echo "$(YELLOW)Cleaning build artifacts$(NC)"
	rm -rf $(BACKEND_DIR)/dist

build: preflight install clean
	@echo "$(GREEN)Building backend$(NC)"
	cd $(BACKEND_DIR) && npm run build

# ------------------------------------------------------------
# Testing
# ------------------------------------------------------------
test:
	cd $(BACKEND_DIR) && npm test

# ------------------------------------------------------------
# Deployment
# ------------------------------------------------------------
deploy-prod: build test
	@echo "$(GREEN)Deploying to production$(NC)"
	bash $(SCRIPTS_DIR)/deploy/deploy-prod.sh
