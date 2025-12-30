-- ============================================
-- AlphaForge ICICI Login Verification Script
-- ============================================

-- 1️⃣ FSM STATE CHECK
SELECT
  'FSM_STATE' AS check,
  user_id,
  state,
  attempts,
  updated_at
FROM icici_login_attempts
ORDER BY updated_at DESC
LIMIT 5;

-- 2️⃣ ICICI SESSION PERSISTENCE CHECK
SELECT
  'ICICI_SESSIONS' AS check,
  user_id,
  session_token,
  created_at
FROM icici_sessions
ORDER BY created_at DESC
LIMIT 3;

-- 3️⃣ BROKER CREDENTIALS CHECK
SELECT
  'BROKER_CREDENTIALS' AS check,
  user_id,
  broker_name,
  session_token,
  last_connected,
  is_active
FROM broker_credentials
WHERE broker_name = 'ICICI';

-- 4️⃣ USER PROFILE CHECK
SELECT
  'USER_PROFILE' AS check,
  user_id,
  full_name,
  phone,
  pan,
  is_verified,
  is_locked
FROM user_profiles;

-- 5️⃣ USER AUTH TABLE (REFERENCE ONLY)
SELECT
  'USERS' AS check,
  id,
  email,
  role,
  created_at
FROM users;
