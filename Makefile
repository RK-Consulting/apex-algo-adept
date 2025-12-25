# ============================================================
# Apex Algo Adept — Authoritative Build & Deploy Makefile
# ============================================================

.DEFAULT_GOAL := help
.SHELL := /usr/bin/env bash
.SHELLFLAGS := -euo pipefail -c

# -----------------------------
# Directories
# -----------------------------
BACKEND_DIR := backend
SCRIPTS_DIR := scripts
DB_SCRIPTS  := $(SCRIPTS_DIR)/db
LOG_DIR     := logs

# -----------------------------
# Environment
# -----------------------------
NODE_ENV ?= production
export NODE_ENV

# -----------------------------
# Colors
# -----------------------------
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

# -----------------------------
# Help
# -----------------------------
help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Core:"
	@echo "  make install        Install dependencies"
	@echo "  make build          Compile backend"
	@echo "  make test           Run tests"
	@echo ""
	@echo "Database:"
	@echo "  make db-verify      Verify DB + FSM invariants"
	@echo "  make db-migrate     Run migrations"
	@echo ""
	@echo "Deploy:"
	@echo "  make deploy-prod    Production deploy"
	@echo ""

# -----------------------------
# Dependencies
# -----------------------------
install:
	@echo "$(GREEN)Installing backend dependencies$(NC)"
	cd $(BACKEND_DIR) && npm ci

# -----------------------------
# Build
# -----------------------------
build: install
	@echo "$(GREEN)Building backend$(NC)"
	cd $(BACKEND_DIR) && npm run build

clean:
	@echo "$(YELLOW)Cleaning artifacts$(NC)"
	rm -rf $(BACKEND_DIR)/dist

# -----------------------------
# Testing
# -----------------------------
test:
	cd $(BACKEND_DIR) && npm test

# -----------------------------
# Database
# -----------------------------
db-verify:
	@echo "$(GREEN)Verifying database integrity$(NC)"
	bash $(DB_SCRIPTS)/verify-db.sh

db-migrate: db-verify
	@echo "$(GREEN)Running DB migrations$(NC)"
	bash $(DB_SCRIPTS)/migrate.sh

icici-verify:
	bash scripts/icici/verify-guard-12-2025.sh

# -----------------------------
# Deployment
# -----------------------------
deploy-prod: clean db-verify build test
	@echo "$(GREEN)Deploying to production$(NC)"
	bash $(SCRIPTS_DIR)/deploy/deploy-prod.sh
