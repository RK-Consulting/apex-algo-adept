// backend/src/scripts/refreshIciciSession.ts
import dotenv from "dotenv";
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";

dotenv.config();

async function refreshIciciSessions() {
  console.log("🚀 Starting ICICI session refresh...");

  const users = await query(`
    SELECT user_id, icici_api_key, icici_api_secret
    FROM user_credentials
    WHERE icici_api_key IS NOT NULL AND icici_api_secret IS NOT NULL
  `);

  if (users.rows.length === 0) {
    console.log("ℹ️ No users with ICICI credentials found.");
    return;
  }

  for (const user of users.rows) {
    try {
      console.log(`🔁 Refreshing session for user: ${user.user_id}`);

      const breeze = new BreezeConnect();
      breeze.setApiKey(user.icici_api_key);

      // Generate new session token using Breeze API
      const newSession = await breeze.generateSession(user.icici_api_secret);
      const newToken = newSession?.data?.session_token || newSession?.session_token;

      if (!newToken) {
        console.warn(`⚠️ No session_token returned for ${user.user_id}`);
        continue;
      }

      await query(
        `UPDATE user_credentials 
         SET icici_session_token = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [newToken, user.user_id]
      );

      console.log(`✅ Updated session token for ${user.user_id}`);
    } catch (err: any) {
      console.error(`❌ Failed to refresh ${user.user_id}:`, err.message);
    }
  }

  console.log("🏁 Session refresh complete.");
}

// Execute directly when called via CLI
refreshIciciSessions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
