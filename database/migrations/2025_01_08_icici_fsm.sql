BEGIN;

/* =========================================================
   1. ICICI LOGIN FSM TABLE (IDEMPOTENT)
========================================================= */
CREATE TABLE IF NOT EXISTS icici_login_attempts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  state text NOT NULL CHECK (
    state IN (
      'IDLE',
      'LOGIN_INITIATED',
      'CALLBACK_RECEIVED',
      'SESSION_ACTIVE',
      'FAILED',
      'LOCKED'
    )
  ),

  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamp without time zone,
  locked_until timestamp without time zone,

  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),

  UNIQUE (user_id)
);

/* =========================================================
   2. INDEXES (SAFE)
========================================================= */
CREATE INDEX IF NOT EXISTS idx_icici_login_state
ON icici_login_attempts(state);

CREATE INDEX IF NOT EXISTS idx_icici_login_locked
ON icici_login_attempts(locked_until);

/* =========================================================
   3. AUTO-UPDATE updated_at
========================================================= */
CREATE OR REPLACE FUNCTION update_icici_login_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_icici_login_updated_at ON icici_login_attempts;

CREATE TRIGGER trg_icici_login_updated_at
BEFORE UPDATE ON icici_login_attempts
FOR EACH ROW
EXECUTE FUNCTION update_icici_login_updated_at();

/* =========================================================
   4. INITIALIZE FSM FOR EXISTING USERS (SAFE UPSERT)
========================================================= */
INSERT INTO icici_login_attempts (user_id, state)
SELECT u.id, 'IDLE'
FROM users u
LEFT JOIN icici_login_attempts ila ON ila.user_id = u.id
WHERE ila.user_id IS NULL;

COMMIT;
