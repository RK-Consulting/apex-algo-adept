#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# AlphaForge – DB Identity & ICICI Verification
# ------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Load ONLY infra-safe vars
"$ROOT_DIR/infra/env/load-backend-env.sh" "$ROOT_DIR/backend/.env"

SQL_FILE="$ROOT_DIR/database/migrations/verify_identity_and_icici.sql"
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

if [[ ! -f "$SQL_FILE" ]]; then
  echo "❌ SQL file not found"
  exit 1
fi

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$SQL_FILE" \
  > "$LOG_FILE" 2>&1

echo "------------------------------------------------------------"
echo "✅ DB verification completed"
echo "------------------------------------------------------------"
