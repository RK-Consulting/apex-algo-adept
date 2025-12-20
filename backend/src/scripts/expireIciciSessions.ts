// backend/src/scripts/expireIciciSessions.ts
/**
 * ICICI Session Expiry Script
 *
 * Purpose:
 * - Periodically remove expired ICICI sessions
 * - DOES NOT touch broker_credentials
 *
 * Data Ownership:
 * - Session lifecycle → icici_sessions table
 * - Credential lifecycle → broker_credentials table
 */

import dotenv from "dotenv";
import { query } from "../config/database.js";

dotenv.config();

/* ======================================================
   CONFIG
====================================================== */
const ICICI_SESSION_TTL_HOURS = 24;

/* ======================================================
   SCRIPT
====================================================== */
async function expireIciciSessions(): Promise<void> {
  console.log("🚀 Checking ICICI session expiry...");

  const dbResult = await query(
    `
    SELECT
      idirect_userid,
      session_token,
      created_at
    FROM icici_sessions
    WHERE created_at < NOW() - INTERVAL '${ICICI_SESSION_TTL_HOURS} hours'
    `
  );

  if ((dbResult.rowCount ?? 0) === 0) {
    console.log("ℹ️ No expired ICICI sessions found.");
    return;
  }

  console.log(`⚠️ Found ${dbResult.rowCount} expired ICICI session(s).`);

  for (const row of dbResult.rows) {
    const serverUserId = row.idirect_userid;
    const createdAt = row.created_at;

    try {
      await query(
        `
        DELETE FROM icici_sessions
        WHERE idirect_userid = $1
        `,
        [serverUserId]
      );

      console.log(
        `❌ Expired ICICI session cleared for user ${serverUserId} (created_at=${createdAt})`
      );
    } catch (err) {
      console.error(
        `🔥 Failed to clear ICICI session for user ${serverUserId}:`,
        err
      );
    }
  }

  console.log("🏁 ICICI session expiry check complete.");
}

/* ======================================================
   EXECUTION
====================================================== */
expireIciciSessions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
