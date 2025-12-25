#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Verifying backend environment variables"

# ------------------------------------------------------------
# Required variables (add/remove consciously)
# ------------------------------------------------------------
REQUIRED_VARS=(
  NODE_ENV
  PORT
  DATABASE_URL
  JWT_SECRET
  CREDENTIALS_ENCRYPTION_KEY
  FRONTEND_ORIGIN
)

# ------------------------------------------------------------
# Check presence
# ------------------------------------------------------------
MISSING=0

for VAR in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!VAR:-}" ]]; then
    echo "❌ Missing required env var: $VAR"
    MISSING=1
  else
    echo "✅ $VAR is set"
  fi
done

if [[ "$MISSING" -ne 0 ]]; then
  echo "❌ Environment verification failed"
  exit 1
fi

# ------------------------------------------------------------
# Basic sanity checks (lightweight, no parsing madness)
# ------------------------------------------------------------

if [[ "$NODE_ENV" != "production" && "$NODE_ENV" != "development" ]]; then
  echo "❌ NODE_ENV must be 'production' or 'development'"
  exit 1
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "❌ PORT must be numeric"
  exit 1
fi

if [[ "$DATABASE_URL" != postgres://* ]]; then
  echo "❌ DATABASE_URL must start with postgres://"
  exit 1
fi

if [[ "${#JWT_SECRET}" -lt 32 ]]; then
  echo "❌ JWT_SECRET is too short (min 32 chars)"
  exit 1
fi

if [[ "${#CREDENTIALS_ENCRYPTION_KEY}" -lt 32 ]]; then
  echo "❌ CREDENTIALS_ENCRYPTION_KEY is too short"
  exit 1
fi

echo "✅ Environment verification passed"
