-- ============================================================
-- AlphaForge DB Verification Script
-- Purpose: Identity de-duplication + ICICI FSM integrity
-- SAFE: Read-only checks only
-- ============================================================

\echo '============================================================'
\echo ' AlphaForge DB Verification Started'
\echo ' Timestamp: ' `date`
\echo '============================================================'

-- ------------------------------------------------------------
-- 1. Users with identity data but missing user_profiles
-- ------------------------------------------------------------
\echo ''
\echo '1) USERS WITH IDENTITY BUT NO PROFILE (MUST BE ZERO)'
SELECT
  u.id,
  u.email,
  u.full_name AS users_full_name,
  u.phone AS users_phone,
  u.pan AS users_pan
FROM users u
LEFT JOIN user_profiles p ON p.user_id = u.id
WHERE
  (u.full_name IS NOT NULL OR u.phone IS NOT NULL OR u.pan IS NOT NULL)
  AND p.user_id IS NULL;

-- ------------------------------------------------------------
-- 2. Identity mismatch between users and user_profiles
-- ------------------------------------------------------------
\echo ''
\echo '2) IDENTITY MISMATCH BETWEEN USERS AND USER_PROFILES (MUST BE ZERO)'
SELECT
  u.id,
  u.email,
  u.full_name AS users_full_name,
  p.full_name AS profile_full_name,
  u.phone AS users_phone,
  p.phone AS profile_phone,
  u.pan AS users_pan,
  p.pan AS profile_pan
FROM users u
JOIN user_profiles p ON p.user_id = u.id
WHERE
  (u.full_name IS DISTINCT FROM p.full_name)
  OR (u.phone IS DISTINCT FROM p.phone)
  OR (u.pan IS DISTINCT FROM p.pan);

-- ------------------------------------------------------------
-- 3. broker_credentials without valid user_profiles link
-- ------------------------------------------------------------
\echo ''
\echo '3) BROKER CREDENTIALS WITHOUT VALID PROFILE LINK (MUST BE ZERO)'
SELECT
  bc.id,
  bc.user_id,
  bc.profile_user_id
FROM broker_credentials bc
LEFT JOIN user_profiles p ON p.user_id = bc.profile_user_id
WHERE p.user_id IS NULL;

-- ------------------------------------------------------------
-- 4. Multiple profiles per user (must never happen)
-- ------------------------------------------------------------
\echo ''
\echo '4) USERS WITH MULTIPLE PROFILES (MUST BE ZERO)'
SELECT user_id, COUNT(*) AS profile_count
FROM user_profiles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ------------------------------------------------------------
-- 5. ICICI login FSM integrity (1 row per user)
-- ------------------------------------------------------------
\echo ''
\echo '5) ICICI LOGIN FSM DUPLICATES (MUST BE ZERO)'
SELECT user_id, COUNT(*) AS fsm_rows
FROM icici_login_attempts
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ------------------------------------------------------------
-- 6. Verified profiles missing verification method
-- ------------------------------------------------------------
\echo ''
\echo '6) VERIFIED PROFILES WITHOUT VERIFIED_VIA (MUST BE ZERO)'
SELECT *
FROM user_profiles
WHERE is_verified = true
  AND verified_via IS NULL;

-- ------------------------------------------------------------
-- 7. Summary counts (informational)
-- ------------------------------------------------------------
\echo ''
\echo '7) SUMMARY COUNTS'
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM user_profiles) AS total_profiles,
  (SELECT COUNT(*) FROM broker_credentials) AS broker_credentials,
  (SELECT COUNT(*) FROM icici_login_attempts) AS icici_login_fsm,
  (SELECT COUNT(*) FROM icici_sessions) AS icici_sessions;

\echo ''
\echo '============================================================'
\echo ' Verification Completed'
\echo '============================================================'
