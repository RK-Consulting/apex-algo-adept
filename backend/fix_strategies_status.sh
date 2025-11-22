#!/bin/bash

# CONFIG
DB_USER="apexuser"
DB_PASS="YourStrongPassword123"
DB_NAME="apexdb"
DB_HOST="localhost"
USER_ID="e6040c6e-ab41-4c12-a21b-cd454ba9f4c3"

export PGPASSWORD="$DB_PASS"

echo "--------------------------------------------------------"
echo "  FIXING STRATEGIES TABLE (adding status column)"
echo "--------------------------------------------------------"

psql -h $DB_HOST -U $DB_USER -d $DB_NAME << EOF

-- 1. Add missing status column
ALTER TABLE strategies 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- 2. Migrate old boolean -> string
UPDATE strategies
SET status = CASE
  WHEN is_active = TRUE THEN 'active'
  ELSE 'paused'
END
WHERE status IS NULL OR status NOT IN ('active', 'paused');

-- 3. Drop old column
ALTER TABLE strategies
DROP COLUMN IF EXISTS is_active;

-- 4. Confirm structure
\d+ strategies;

-- 5. Show credentials for debugging
SELECT * FROM user_credentials WHERE user_id = '$USER_ID';
EOF

echo "--------------------------------------------------------"
echo "  ✅ MIGRATION COMPLETE"
echo "--------------------------------------------------------"

