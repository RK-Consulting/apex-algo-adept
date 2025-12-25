#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/backend/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ backend/.env not found at $ENV_FILE"
  exit 1
fi

echo "🔐 Loading backend environment from $ENV_FILE"
set -a
source "$ENV_FILE"
set +a
