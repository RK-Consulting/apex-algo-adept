#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo " AlphaForge — ICICI Guard & FSM Verification"
echo "============================================================"

# ------------------------------------------------------------
# Resolve project root
# ------------------------------------------------------------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Load backend environment (NO sourcing of .env directly)
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not present in environment"
  echo "   Load via systemd / PM2 / Makefile before running"
  exit 1
fi

LOG_DIR="$ROOT_DIR/logs/icici-verification"
TIMESTAMP="$(date +%F_%H-%M-%S)"
LOG_FILE="$LOG_DIR/icici_guard_verify_$TIMESTAMP.log"

mkdir -p "$LOG_DIR"

echo "🗄 Database : $DATABASE_URL"
echo "📄 Log File : $LOG_FILE"
echo "------------------------------------------------------------"

# ------------------------------------------------------------
# SQL checks (inline, immutable, auditable)
# ------------------------------------------------------------
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL' > "$LOG_FILE" 2>&1

-- ============================================================
-- 1. FSM cardinality check
-- ============================================================
SELECT 'FSM_DUPLICATES' AS check, user_id, COUNT(*)
FROM icici_login_attempts
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ============================================================
-- 2. Invalid FSM states
-- ============================================================
SELECT 'INVALID_FSM_STATE' AS check, user_id, state
FROM icici_login_attempts
WHERE state NOT IN (
  'IDLE',
  'LOGIN_INITIATED',
  'CALLBACK_RECEIVED',
  'SESSION_ACTIVE',
  'FAILED',
  'LOCKED'
);

-- ============================================================
-- 3. LOCKED users without lock expiry
-- ============================================================
SELECT 'LOCK_WITHOUT_EXPIRY' AS check, user_id
FROM icici_login_attempts
WHERE state = 'LOCKED'
  AND locked_until IS NULL;

-- ============================================================
-- 4. FSM says ACTIVE but no session exists
-- ============================================================
SELECT 'FSM_ACTIVE_NO_SESSION' AS check, f.user_id
FROM icici_login_attempts f
LEFT JOIN icici_sessions s ON s.user_id = f.user_id
WHERE f.state = 'SESSION_ACTIVE'
  AND s.id IS NULL;

-- ============================================================
-- 5. Session exists but FSM not ACTIVE
-- ============================================================
SELECT 'SESSION_WITHOUT_ACTIVE_FSM' AS check, s.user_id
FROM icici_sessions s
LEFT JOIN icici_login_attempts f ON f.user_id = s.user_id
WHERE f.state IS DISTINCT FROM 'SESSION_ACTIVE';

-- ============================================================
-- 6. Credentials without verified profile
-- ============================================================
SELECT 'CREDENTIAL_PROFILE_MISMATCH' AS check, bc.user_id
FROM broker_credentials bc
LEFT JOIN user_profiles up ON up.user_id = bc.user_id
WHERE bc.broker_name = 'ICICI'
  AND bc.is_active = true
  AND (up.is_verified IS DISTINCT FROM true OR up.is_locked = true);

SQL

echo "------------------------------------------------------------"
echo "✅ ICICI Guard verification completed"
echo "📄 Review log: $LOG_FILE"
echo "------------------------------------------------------------"
