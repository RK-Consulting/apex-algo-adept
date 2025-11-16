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
    WHERE icici_api_key IS NOT NULL 
      AND icici_api_secret IS NOT NULL
  `);

  if (users.rows.length === 0) {
    console.log("ℹ️ No users with ICICI credentials found.");
    return;
  }

  for (const user of users.rows) {
    try {
      console.log(`🔁 Refreshing session for user: ${user.user_id}`);

      if (!user.icici_api_key || !user.icici_api_secret) {
        console.warn(`⚠️ Missing API key/secret for ${user.user_id}`);
        continue;
      }

      // Initialize Breeze
      const breeze = new BreezeConnect();
      breeze.setApiKey(user.icici_api_key);

      // Generate new session/token
      const sessionResponse = await breeze.generateSession(user.icici_api_secret);

      // Extract session token from multiple possible formats
      const newToken =
        sessionResponse?.data?.session_token ||
        sessionResponse?.session_token ||
        (breeze as any).sessionToken ||
        (breeze as any).getSessionToken?.() ||
        null;

      if (!newToken) {
        console.warn(`⚠️ No session_token returned for ${user.user_id}`);
        console.log("Full session response:", sessionResponse);
        continue;
      }

      // Save the new token
      await query(
        `UPDATE user_credentials 
         SET icici_session_token = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [newToken, user.user_id]
      );

      console.log(`✅ Updated session token for ${user.user_id}`);

    } catch (err: any) {
      console.error(`❌ Failed to refresh ${user.user_id}:`, err?.message || err);
    }
  }

  console.log("🏁 Session refresh complete.");
}

// Run via CLI: node refreshIciciSession.js
refreshIciciSessions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
