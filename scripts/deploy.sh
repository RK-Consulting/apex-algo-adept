#!/bin/bash
set -e  # exit immediately on any error — no silent partial deploys

# ==========================================
# AlphaForge Backend — Deploy Script
# Usage: ./scripts/deploy.sh [branch]
# Default branch: 0.2.0_dev
# ==========================================

BRANCH="${1:-0.2.0_dev}"
APP_DIR="/var/www/alphaforge"
BACKEND_DIR="$APP_DIR/backend"
PM2_APP_NAME="alphaforge-backend"

echo "🚀 Deploying AlphaForge backend — branch: $BRANCH"
echo ""

# 1. Pull latest code
echo "📥 Pulling latest code..."
cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# 2. Confirm .env exists — refuse to proceed without it (no silent broken deploys)
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "❌ ERROR: $BACKEND_DIR/.env not found."
  echo "   This script will NOT create it for you — copy it from a secure backup"
  echo "   (never from git — .env is never committed) before running deploy again."
  exit 1
fi

# 3. Install dependencies
echo "📦 Installing dependencies..."
cd "$BACKEND_DIR"
npm install

# 4. Build
echo "🔨 Building..."
npm run build

# 5. Run tests — abort deploy if they fail
echo "🧪 Running tests..."
npm test

# 6. Restart under pm2 (start fresh if not already running)
echo "♻️  Restarting pm2 process..."
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start dist/server.js --name "$PM2_APP_NAME" --cwd "$BACKEND_DIR"
fi
pm2 save

# 7. Health check
echo "🩺 Checking health endpoint..."
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://api.alphaforge.skillsifter.in/health)
if [ "$HEALTH" == "200" ]; then
  echo "✅ Deploy successful — health check passed (HTTP $HEALTH)"
else
  echo "⚠️  WARNING: health check returned HTTP $HEALTH — check 'pm2 logs $PM2_APP_NAME'"
  exit 1
fi
