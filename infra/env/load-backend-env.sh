#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$1"

if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" ]]; then
  echo "❌ ENV file not found: $ENV_FILE"
  exit 1
fi

# Only extract what infra needs — nothing else
export DATABASE_URL="$(
  grep -E '^DATABASE_URL=' "$ENV_FILE" \
  | sed 's/^DATABASE_URL=//'
)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL missing in $ENV_FILE"
  exit 1
fi
