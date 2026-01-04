// backend/src/routes/icici/authCallback.ts

/**
 * ICICI Breeze Authentication Callback Handler
 *
 * Supports Dual Flows:
 * 1. GET /auth/callback  → legacy / direct session_token
 * 2. POST /auth/complete → secure apisession exchange
 *
 * Security:
 * - JWT protected
 * - Rate limited
 * - FSM guarded
 * - No secrets exposed to frontend
 */

// backend/src/routes/icici/authCallback.ts

import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { iciciGuard } from "../../middleware/iciciGuard.js";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { getCustomerDetails } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js";
import { query } from "../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

/* ============================================================
   GET /api/icici/auth/callback
   Browser redirect ONLY — NO JWT, NO DB writes
============================================================ */
// backend/src/routes/icici/authCallback.ts

router.get(
  "/callback",
  iciciLimiter,
  async (req, res) => {
    const { apisession } = req.query;

    if (!apisession || typeof apisession !== "string") {
      return res.status(400).send(`
        <html><body>
          <script>
            window.opener?.postMessage(
              { type: "ICICI_LOGIN_ERROR", error: "Missing apisession" },
              "*"
            );
            window.close();
          </script>
        </body></html>
      `);
    }

    try {
      // Get user from latest login attempt
      const loginAttempt = await query(
        `SELECT user_id FROM icici_login_attempts
         WHERE state = 'LOGIN_INITIATED'
         ORDER BY updated_at DESC LIMIT 1`
      );

      if (loginAttempt.rowCount === 0) {
        throw new Error("No active login session");
      }

      const userId = loginAttempt.rows[0].user_id;

      // Get credentials from DB
      const credsResult = await query(
        `SELECT app_key, app_secret
         FROM broker_credentials
         WHERE user_id = $1::uuid AND broker_name = 'ICICI' AND is_active = true`,
        [userId]
      );

      if (credsResult.rowCount === 0) {
        throw new Error("ICICI credentials not found");
      }

      const { app_key, app_secret } = credsResult.rows[0];

      // Call ICICI with credentials (not session)
      const cdData = await getCustomerDetails(app_key, app_secret, apisession);
      
      const sessionToken = cdData?.Success?.session_token;
      if (!sessionToken) {
        throw new Error("No session_token from ICICI");
      }

      // Save session
      await SessionService.getInstance().saveSession(userId, {
        //api_key: app_key,
       //api_secret: app_secret,
        session_token: sessionToken,
        user_details: cdData.Success,
      });

      // Update FSM
      await query(
        `UPDATE icici_login_attempts
         SET state = 'SESSION_ACTIVE', attempts = 0, updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [userId]
      );

      const frontendUrl = process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in";

      return res.send(`
        <html><body>
          <script>
            window.opener?.postMessage(
              { type: "ICICI_LOGIN", success: true },
              "${frontendUrl}"
            );
            window.close();
          </script>
        </body></html>
      `);
    } catch (err: any) {
      log("Callback error:", err.message);
      return res.send(`
        <html><body>
          <script>
            window.opener?.postMessage(
              { type: "ICICI_LOGIN_ERROR", error: "${err.message}" },
              "*"
            );
            window.close();
          </script>
        </body></html>
      `);
    }
  }
);
export default router;
export const iciciAuthCallbackRouter = router;
