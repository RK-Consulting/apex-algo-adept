// backend/src/routes/icici/authCallback.ts
/**
 * ICICI Breeze Authentication Callback Handler
 * Handles callback in POPUP window - closes popup after success
 */
import { Router } from "express";
import debug from "debug";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { generateIciciSession } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js";
import { query } from "../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

router.all(
  "/callback",
  iciciLimiter,
  async (req, res) => {
    console.log("🟢 ICICI CALLBACK HIT");
    console.log("➡️ Method:", req.method);
    console.log("➡️ Query:", req.query);
    console.log("➡️ Body:", req.body);

    try {
      const apisession =
        (req.method === "GET"
          ? req.query.apisession
          : req.body?.apisession) as string;

      console.log("➡️ Extracted apisession:", apisession);

      if (!apisession) {
        console.error("❌ Missing apisession parameter");
        return res.send(getErrorPage("Missing session parameter from ICICI"));
      }

      console.log("🟢 Looking up LOGIN_INITIATED attempt");

      // 1) Resolve user from latest LOGIN_INITIATED attempt
      const loginAttempt = await query(
        `SELECT user_id FROM icici_login_attempts 
         WHERE state = 'LOGIN_INITIATED' 
         ORDER BY updated_at DESC 
         LIMIT 1`
      );

      console.log("➡️ loginAttempt.rowCount =", loginAttempt.rowCount);

      if (loginAttempt.rowCount === 0) {
        throw new Error("No active ICICI login session found");
      }

      const userId = loginAttempt.rows[0].user_id;
      console.log("🟢 Processing callback for user:", userId);

      // 2) Fetch credentials
      console.log("🟢 Fetching ICICI credentials");

      const credsResult = await query(
        `SELECT app_key, app_secret 
         FROM broker_credentials 
         WHERE user_id = $1::uuid 
           AND broker_name = 'ICICI' 
           AND is_active = true`,
        [userId]
      );

      console.log("➡️ credsResult.rowCount =", credsResult.rowCount);

      if (credsResult.rowCount === 0) {
        throw new Error("ICICI credentials not found");
      }

      const { app_key, app_secret } = credsResult.rows[0];
      console.log("🟢 Credentials loaded (app_key present)");

      console.log("🟡 Calling generateIciciSession()");

      const sessionToken = await generateIciciSession(
        userId,
        app_key,
        app_secret,
        apisession
      );

      console.log("➡️ generateIciciSession returned:", sessionToken);

      if (!sessionToken) {
        throw new Error("No session_token returned from ICICI");
      }

      console.log(
        "🟢 Session token received:",
        sessionToken.substring(0, 6) + "..."
      );

      // 3) Save session and update FSM
      console.log("🟢 Saving session via SessionService");

      await SessionService.getInstance().saveSession(userId, {
        api_key: app_key,
        api_secret: app_secret,
        session_token: sessionToken
      });

      console.log("🟢 Updating FSM → SESSION_ACTIVE");

      await query(
        `UPDATE icici_login_attempts 
         SET state = 'SESSION_ACTIVE', 
             attempts = 0, 
             updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [userId]
      );

      console.log("✅ ICICI connection successful for user:", userId);

      return res.send(getSuccessPage());
    } catch (err: any) {
      console.error("❌ ICICI CALLBACK ERROR:", err);

      try {
        console.log("🟡 Updating FSM → FAILED");

        await query(
          `UPDATE icici_login_attempts 
           SET state = 'FAILED', 
               updated_at = NOW()
           WHERE state = 'LOGIN_INITIATED'`
        );
      } catch (fsmErr) {
        console.error("❌ FSM update failed:", fsmErr);
      }

      return res.send(getErrorPage(err.message));
    }
  }
);

export default router;
export const iciciAuthCallbackRouter = router;
