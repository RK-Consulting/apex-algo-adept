#!/bin/bash
# ==============================================================================
# AlphaForge — Server Backup Script
# Run as: sudo ./backup.sh
# Output: /home/harisha/backups/alphaforge_backup_<timestamp>.tar.gz
#
# Scope: this backs up AlphaForge's own database, config, and app state,
# plus shared server-level facts (UFW, installed packages, cron) that any
# fresh-server rebuild needs regardless of which app is being restored.
# It does NOT reference or depend on any other application on this server.
# ==============================================================================
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="/home/harisha/backups"
WORKDIR="$BACKUP_ROOT/alphaforge_backup_$TIMESTAMP"
ARCHIVE="$BACKUP_ROOT/alphaforge_backup_$TIMESTAMP.tar.gz"

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root or with sudo (needed for pg_dump, nginx, letsencrypt, ufw)."
  exit 1
fi

mkdir -p "$WORKDIR"
echo "🚀 Starting AlphaForge backup -> $WORKDIR"

# ------------------------------------------------------------------
# 1. PostgreSQL — apexdb only
# ------------------------------------------------------------------
echo "📊 Backing up apexdb..."
mkdir -p "$WORKDIR/postgres"
sudo -u postgres pg_dump -Fc apexdb -f "$WORKDIR/postgres/apexdb.dump" \
  && echo "  ✅ apexdb (custom format)" || echo "  ❌ apexdb dump failed"
sudo -u postgres pg_dump apexdb -f "$WORKDIR/postgres/apexdb.sql" \
  && echo "  ✅ apexdb (plain SQL)" || echo "  ❌ apexdb SQL dump failed"
sudo -u postgres psql -c "\du apexuser" > "$WORKDIR/postgres/role.txt" 2>&1 || true

# ------------------------------------------------------------------
# 2. Redis — used by AlphaForge (session caching / rate limiting)
# ------------------------------------------------------------------
echo "💾 Backing up Redis..."
mkdir -p "$WORKDIR/redis"
REDIS_PASS=$(grep "^requirepass" /etc/redis/redis.conf | awk '{print $2}')
redis-cli -a "$REDIS_PASS" --no-auth-warning BGSAVE >/dev/null 2>&1 || true
sleep 2
cp /var/lib/redis/dump.rdb "$WORKDIR/redis/dump.rdb" 2>&1 \
  && echo "  ✅ Redis RDB snapshot" || echo "  ⚠️  Redis RDB copy failed"
cp /etc/redis/redis.conf "$WORKDIR/redis/redis.conf.reference"

# ------------------------------------------------------------------
# 3. Nginx — AlphaForge's site config only
# ------------------------------------------------------------------
echo "🌐 Backing up AlphaForge Nginx config..."
mkdir -p "$WORKDIR/nginx"
cp /etc/nginx/sites-available/api.alphaforge.skillsifter.in "$WORKDIR/nginx/" 2>&1 \
  && echo "  ✅ api.alphaforge.skillsifter.in config" || echo "  ⚠️  config not found at expected path"

# ------------------------------------------------------------------
# 4. Let's Encrypt certificate — AlphaForge domain only
# ------------------------------------------------------------------
echo "🔒 Backing up SSL certificate..."
mkdir -p "$WORKDIR/letsencrypt"
tar -czf "$WORKDIR/letsencrypt/api_alphaforge_cert.tar.gz" \
  /etc/letsencrypt/live/api.alphaforge.skillsifter.in \
  /etc/letsencrypt/archive/api.alphaforge.skillsifter.in \
  /etc/letsencrypt/renewal/api.alphaforge.skillsifter.in.conf 2>/dev/null \
  && echo "  ✅ Certificate archived" || echo "  ⚠️  Cert archive had issues"

# ------------------------------------------------------------------
# 5. AlphaForge app state — .env, git commit, Docker image
# ------------------------------------------------------------------
echo "📦 Backing up AlphaForge app state..."
mkdir -p "$WORKDIR/app"
if [ -f /var/www/alphaforge/backend/.env ]; then
  cp /var/www/alphaforge/backend/.env "$WORKDIR/app/backend.env"
  echo "  ✅ backend .env (SENSITIVE — contains live secrets)"
fi
cd /var/www/alphaforge 2>/dev/null && git log -1 --oneline > "$WORKDIR/app/git_commit.txt" 2>&1 || true
docker inspect alphaforge-backend --format '{{.Config.Image}} | {{.Created}}' \
  > "$WORKDIR/app/docker_image_info.txt" 2>&1 || true
echo "  ✅ Git commit + Docker image reference"

# ------------------------------------------------------------------
# 6. Shared server-level facts — captured independently, not a
#    reference to any other application
# ------------------------------------------------------------------
echo "🔥 Backing up UFW rules..."
mkdir -p "$WORKDIR/server"
ufw status verbose > "$WORKDIR/server/ufw_status.txt"

echo "⏰ Backing up crontabs..."
crontab -u harisha -l > "$WORKDIR/server/harisha_crontab.txt" 2>&1 || echo "(none)" > "$WORKDIR/server/harisha_crontab.txt"
crontab -u root -l > "$WORKDIR/server/root_crontab.txt" 2>&1 || echo "(none)" > "$WORKDIR/server/root_crontab.txt"

echo "📝 Documenting installed packages..."
dpkg --get-selections > "$WORKDIR/server/apt_packages.txt"
npm list -g --depth=0 > "$WORKDIR/server/npm_global_packages.txt" 2>&1
node --version > "$WORKDIR/server/node_version.txt" 2>&1

{
  echo "Hostname: $(hostname)"
  echo "OS: $(lsb_release -d 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME)"
  echo "Kernel: $(uname -r)"
  echo "Disk: $(df -h / | tail -1)"
  echo "Memory: $(free -h | grep Mem)"
  echo "Backup taken: $(date)"
} > "$WORKDIR/server/system_info.txt"
echo "  ✅ Server-level facts (UFW, cron, packages, system info)"

# ------------------------------------------------------------------
# Compress
# ------------------------------------------------------------------
echo "📦 Compressing archive..."
tar -czf "$ARCHIVE" -C "$BACKUP_ROOT" "alphaforge_backup_$TIMESTAMP"
rm -rf "$WORKDIR"

SIZE=$(du -h "$ARCHIVE" | cut -f1)
echo ""
echo "========================================"
echo "✅ ALPHAFORGE BACKUP COMPLETE"
echo "========================================"
echo "📁 Archive: $ARCHIVE"
echo "💾 Size: $SIZE"
echo ""
echo "⚠️  Contains live secrets (.env, DB dump). Download off this"
echo "   server and don't retain local copies longer than needed."
echo ""
echo "📥 scp harisha@$(curl -s ifconfig.me):$ARCHIVE ./"
echo "========================================"