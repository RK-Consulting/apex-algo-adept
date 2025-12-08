// backend/src/scripts/expireIciciSessions.ts
import dotenv from "dotenv";
import { query } from "../config/database.js";

dotenv.config();

async function expireIciciSessions() {
  console.log("🚀 Checking ICICI session expiry...");

  const rows = await query(`
    SELECT user_id, icici_credentials
    FROM user_credentials
    WHERE broker_name = 'icici'
      AND icici_credentials IS NOT NULL
  `);

  if (rows.rowCount === 0) {
    console.log("ℹ️ No ICICI sessions found.");
    return;
  }

  for (const r of rows.rows) {
    try {
      const creds = JSON.parse(r.icici_credentials);
      const expiresAt = creds?.expires_at;

      if (!expiresAt) {
        console.log(`ℹ️ User ${r.user_id} has no expiry → leaving session untouched`);
        continue;
      }

      const now = new Date();
      const expiry = new Date(expiresAt);

      if (expiry <= now) {
        console.log(`❌ Session expired for user ${r.user_id} — clearing`);

        await query(
          `UPDATE user_credentials
           SET icici_credentials = NULL, updated_at = NOW()
           WHERE user_id = $1 AND broker_name = 'icici'`,
          [r.user_id]
        );
      } else {
        console.log(`✔ User ${r.user_id} session valid until ${expiresAt}`);
      }
    } catch (err) {
      console.error(`Error processing user ${r.user_id}:`, err);
    }
  }

  console.log("🏁 Expiry check complete.");
}

expireIciciSessions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
