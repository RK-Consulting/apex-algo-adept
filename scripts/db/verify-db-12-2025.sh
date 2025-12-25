#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SQL_FILE="$ROOT_DIR/database/migrations/verify_identity_and_icici.sql"
LOG_DIR="$ROOT_DIR/logs/db-verification"
TIMESTAMP="$(date +%F_%H-%M-%S)"
LOG_FILE="$LOG_DIR/verify_$TIMESTAMP.log"

mkdir -p "$LOG_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "❌ SQL file missing: $SQL_FILE"
  exit 1
fi

echo "▶ Running DB verification"
psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f "$SQL_FILE" \
  > "$LOG_FILE" 2>&1

echo "✅ DB verification passed"
echo "📄 Log: $LOG_FILE"
