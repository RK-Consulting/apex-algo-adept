#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AlphaForge – Database Identity & ICICI Verification Runner
# ============================================================

# Resolve project root safely
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Load backend .env explicitly (audit-safe)
ENV_FILE="$ROOT_DIR/backend/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "❌ Backend .env not found at $ENV_FILE"
  exit 1
fi


# SQL verification script (as per your structure)
SQL_FILE="$ROOT_DIR/database/migrations/verify_identity_and_icici.sql"

# Logs
LOG_DIR="$ROOT_DIR/logs/db-verification"
TIMESTAMP="$(date +%F_%H-%M-%S)"
LOG_FILE="$LOG_DIR/verify_identity_$TIMESTAMP.log"

mkdir -p "$LOG_DIR"

echo "============================================================"
echo " AlphaForge DB Verification"
echo "============================================================"
echo " SQL File : $SQL_FILE"
echo " Log File : $LOG_FILE"
echo " Started  : $(date)"
echo "============================================================"

# Safety checks
if [[ ! -f "$SQL_FILE" ]]; then
  echo "❌ SQL file not found: $SQL_FILE"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set in environment"
  exit 1
fi

# Execute verification (fail fast, audit-safe)
psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$SQL_FILE" \
  > "$LOG_FILE" 2>&1

echo "------------------------------------------------------------"
echo "✅ DB verification completed successfully"
echo "📄 Output saved to: $LOG_FILE"
echo "------------------------------------------------------------"
