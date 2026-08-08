#!/bin/bash
# ==============================================================================
# AlphaForge — Fresh Server Provisioning Script
# Run as: sudo ./provision.sh /path/to/alphaforge_backup_<timestamp>.tar.gz
#
# What this DOES automate:
#   - Installs Docker, Nginx, PostgreSQL, Redis, Certbot, UFW, Node.js
#   - Restores apexdb from the backup archive
#   - Restores Redis data
#   - Restores AlphaForge's Nginx site config
#   - Re-enables UFW
#   - Rebuilds and starts the AlphaForge Docker container
#
# What this DOES NOT automate (needs your manual judgment):
#   - Pointing DNS at the new server's IP (do this BEFORE running certbot)
#   - Waiting for DNS propagation
#   - Re-issuing SSL certs (restoring old ones only works within the same
#     domain + validity window — a genuine migration should re-issue)
#   - Rotating secrets that were ever exposed before this migration
#
# Scope: this script only sets up AlphaForge. If other applications also
# run on this server, they need their own separate provisioning.
# ==============================================================================
set -e

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root or with sudo."
  exit 1
fi

BACKUP_ARCHIVE="$1"
if [ -z "$BACKUP_ARCHIVE" ] || [ ! -f "$BACKUP_ARCHIVE" ]; then
  echo "Usage: sudo ./provision.sh /path/to/alphaforge_backup_<timestamp>.tar.gz"
  exit 1
fi

RESTORE_DIR="/tmp/alphaforge_restore_$(date +%s)"
mkdir -p "$RESTORE_DIR"
echo "📦 Extracting backup archive to $RESTORE_DIR..."
tar -xzf "$BACKUP_ARCHIVE" -C "$RESTORE_DIR"
BACKUP_CONTENT_DIR=$(find "$RESTORE_DIR" -maxdepth 1 -type d -name "alphaforge_backup_*")

echo ""
echo "========================================"
echo "🚀 Starting fresh server provisioning — AlphaForge"
echo "========================================"

# ------------------------------------------------------------------
# 1. Core packages
# ------------------------------------------------------------------
echo "📥 Installing core packages..."
apt-get update -qq
apt-get install -y -qq \
  nginx postgresql redis-server certbot python3-certbot-nginx \
  ufw git curl build-essential

# ------------------------------------------------------------------
# 2. Node.js
# ------------------------------------------------------------------
echo "📥 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs

# ------------------------------------------------------------------
# 3. Docker
# ------------------------------------------------------------------
echo "📥 Installing Docker..."
curl -fsSL https://get.docker.com | sh
usermod -aG docker harisha 2>/dev/null || echo "  ⚠️  User 'harisha' doesn't exist yet — add manually: usermod -aG docker <user>"

# ------------------------------------------------------------------
# 4. PostgreSQL — restore apexdb
# ------------------------------------------------------------------
echo "📊 Restoring apexdb..."
sudo -u postgres psql -c "CREATE USER apexuser WITH PASSWORD 'CHANGE_ME_APEXUSER_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE apexdb OWNER apexuser;"
sudo -u postgres pg_restore -d apexdb "$BACKUP_CONTENT_DIR/postgres/apexdb.dump" 2>&1 || \
  echo "  ⚠️  apexdb restore had warnings — check output above"

echo "  ⚠️  IMPORTANT: change the placeholder password immediately:"
echo "     sudo -u postgres psql -c \"ALTER USER apexuser WITH PASSWORD 'new-strong-password';\""
echo "     Then update DATABASE_URL in backend/.env to match."
echo "     (If the password contains special characters like '/', percent-encode"
echo "     them in the connection string — e.g. '/' becomes '%2F'.)"

# ------------------------------------------------------------------
# 5. Redis — restore data, set NEW password
# ------------------------------------------------------------------
echo "💾 Restoring Redis..."
systemctl stop redis-server
cp "$BACKUP_CONTENT_DIR/redis/dump.rdb" /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb
echo "  ⚠️  Set a NEW Redis password (don't reuse the old one):"
echo "     sudo sed -i 's/^requirepass .*/requirepass YOUR_NEW_PASSWORD/' /etc/redis/redis.conf"
systemctl start redis-server
echo "  ✅ Redis data restored — set the password above before going live"

# ------------------------------------------------------------------
# 6. Nginx config
# ------------------------------------------------------------------
echo "🌐 Restoring Nginx configuration..."
cp "$BACKUP_CONTENT_DIR/nginx/api.alphaforge.skillsifter.in" /etc/nginx/sites-available/ 2>/dev/null \
  && echo "  ✅ Site config copied to sites-available" || echo "  ⚠️  Config not found in backup"
echo "  ⚠️  Don't enable the site or run certbot yet — do this AFTER DNS points"
echo "     to this server's new IP:"
echo "     ln -s /etc/nginx/sites-available/api.alphaforge.skillsifter.in /etc/nginx/sites-enabled/"
echo "     certbot --nginx -d api.alphaforge.skillsifter.in"

# ------------------------------------------------------------------
# 7. UFW
# ------------------------------------------------------------------
echo "🔥 Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "  ✅ UFW enabled with SSH + Nginx allowed"

# ------------------------------------------------------------------
# 8. AlphaForge app — clone, restore .env, build, run
# ------------------------------------------------------------------
echo "📦 Setting up AlphaForge application..."
mkdir -p /var/www/alphaforge
chown harisha:harisha /var/www/alphaforge 2>/dev/null || true
echo "  ⚠️  Manual step: clone the repo and restore the .env:"
echo "     su - harisha"
echo "     git clone -b main git@github.com:RK-Consulting/alphaforge.git /var/www/alphaforge"
echo "     cp $BACKUP_CONTENT_DIR/app/backend.env /var/www/alphaforge/backend/.env"
echo "     # Edit .env: update DATABASE_URL / REDIS_PASSWORD to match the NEW"
echo "     # passwords set in steps 4-5 — do not reuse old credentials"
echo "     cd /var/www/alphaforge/backend"
echo "     docker build -t alphaforge-backend ."
echo "     docker run -d --name alphaforge-backend --network=host --env-file .env --restart unless-stopped alphaforge-backend"

echo ""
echo "========================================"
echo "✅ PROVISIONING COMPLETE — MANUAL STEPS REMAIN"
echo "========================================"
echo "Before this server is truly live, you must:"
echo "  1. Point DNS (api.alphaforge.skillsifter.in) at this server's new IP"
echo "  2. Wait for DNS propagation (check: dig +short api.alphaforge.skillsifter.in)"
echo "  3. Set new DB/Redis passwords (see warnings above) — never reuse old ones"
echo "  4. Update backend/.env with the new passwords"
echo "  5. Enable the Nginx site + run certbot for a fresh SSL cert (see step 6)"
echo "  6. Build and start the AlphaForge Docker container (see step 8)"
echo "  7. Test end-to-end before decommissioning the old server"
echo "  8. Update Cloudflare Pages build settings if the API URL changed"
echo "========================================"