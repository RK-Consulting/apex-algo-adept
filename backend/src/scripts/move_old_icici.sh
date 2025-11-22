#!/usr/bin/env bash
set -euo pipefail

OLD_DIR="backend/src/icici_old"
mkdir -p "$OLD_DIR"

FILES=(
  "backend/src/routes/icici/authCallback.ts"
  "backend/src/routes/icici/marketData.ts"
  "backend/src/routes/icici/orders.ts"
  "backend/src/routes/icici/portfolio.ts"
  "backend/src/routes/icici/me.ts"
  "backend/src/routes/icici/status.ts"
  "backend/src/iciciBacktest.ts"
)

echo "Moving old ICICI files to $OLD_DIR"

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    mv -v "$f" "$OLD_DIR/"
  else
    echo "(skip, missing) $f"
  fi
done

echo "Done. Old ICICI files moved to $OLD_DIR"

