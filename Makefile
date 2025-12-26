# ============================================================
# Apex Algo Adept — Clean Build, Verify & Deploy Makefile
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
NODE_ENV ?= development
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
	@echo "Development:"
	@echo "  make install-dev      Install deps (npm install)"
	@echo "  make build            Build backend (dev)"
	@echo "  make test             Run tests"
	@echo ""
	@echo "Verification:"
	@echo "  make env-verify       Verify environment variables"
	@echo "  make db-verify        Verify database + FSM invariants"
	@echo "  make icici-verify     Verify ICICI guards & FSM"
	@echo "  make preflight        Run ALL verifications"
	@echo ""
	@echo "CI / Production:"
	@echo "  make install-ci       Clean install (npm ci)"
	@echo "  make build-ci         Strict CI build"
	@echo "  make deploy-prod      Production deploy"
	@echo ""

# ------------------------------------------------------------
# Permissions
# ------------------------------------------------------------
.PHONY: set-permissions
set-permissions:
	@echo "$(GREEN)Enforcing script permissions$(NC)"
	@find $(SCRIPTS_DIR) -type f -name "*.sh" -exec chmod +x {} \;

# ------------------------------------------------------------
# Dependency Installation
# ------------------------------------------------------------
.PHONY: install-dev
install-dev:
	@echo "$(GREEN)Installing backend dependencies (DEV)$(NC)"
	cd $(BACKEND_DIR) && npm install

.PHONY: install-ci
install-ci:
	@echo "$(GREEN)Installing backend dependencies (CI)$(NC)"
	cd $(BACKEND_DIR) && npm ci

# ------------------------------------------------------------
# Environment Verification
# ------------------------------------------------------------
.PHONY: env-verify
env-verify:
	@echo "$(GREEN)Verifying environment variables$(NC)"
	@set -a && source $(ENV_FILE) && set +a && bash $(ENV_SCRIPTS)/verify-env.sh

# ------------------------------------------------------------
# Database Verification
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
# ICICI Verification
# ------------------------------------------------------------
.PHONY: icici-verify
icici-verify:
	@echo "$(GREEN)Verifying ICICI FSM & guard invariants$(NC)"
	@set -a && source $(ENV_FILE) && set +a && bash $(ICICI_SCRIPTS)/verify-guard-12-2025.sh

# ------------------------------------------------------------
# Preflight
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
build: preflight clean
	@echo "$(GREEN)Building backend (DEV)$(NC)"
	cd $(BACKEND_DIR) && npm run build

.PHONY: build-ci
build-ci: preflight clean install-ci
	@echo "$(GREEN)Building backend (CI)$(NC)"
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
deploy-prod: NODE_ENV=production
deploy-prod: build-ci test
	@echo "$(GREEN)Deploying to production$(NC)"
	bash $(SCRIPTS_DIR)/deploy/deploy-prod.sh
