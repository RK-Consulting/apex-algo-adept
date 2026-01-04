// backend/src/routes/icici/authCallback.ts

/**
 * ICICI Breeze Authentication Callback Handler
 * OPTION 2: Single redirect flow - deterministic, production-safe
 */

import { Router } from "express";
import debug from "debug";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { getCustomerDetails } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js";
import { query } from "../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

/* ============================================================
   GET /api/icici/auth/callback
   OPTION 2: Single source of truth, NO JWT required
============================================================ */
router.get(
  "/callback",
  iciciLimiter,
  async (req, res) => {
    const { apisession } = req.query;

    if (!apisession || typeof apisession !== "string") {
      return res.redirect(
        `${process.env.FRONTEND_ORIGIN}/dashboard?icici_error=missing_apisession`
      );
    }

    try {
      // 1. Resolve user from latest LOGIN_INITIATED attempt
      const loginAttempt = await query(
        `SELECT user_id FROM icici_login_attempts
         WHERE state = 'LOGIN_INITIATED'
         ORDER BY updated_at DESC LIMIT 1`
      );

      if (loginAttempt.rowCount === 0) {
        throw new Error("No active ICICI login session found");
      }

      const userId = loginAttempt.rows[0].user_id;
      log("Processing callback for user:", userId);

      // 2. Fetch credentials from DB
      const credsResult = await query(
        `SELECT app_key, app_secret
         FROM broker_credentials
         WHERE user_id = $1::uuid 
           AND broker_name = 'ICICI' 
           AND is_active = true`,
        [userId]
      );

      if (credsResult.rowCount === 0) {
        throw new Error("ICICI credentials not found");
      }

      const { app_key, app_secret } = credsResult.rows[0];

      // 3. Exchange apisession for session_token (with timeout)
      const cdData = await Promise.race([
        getCustomerDetails(app_key, app_secret, apisession),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("ICICI API timeout")), 15000)
        ),
      ]);

      const sessionToken = cdData?.Success?.session_token;
      if (!sessionToken) {
        throw new Error("No session_token returned from ICICI");
      }

      // 4. Save session to Redis + DB
      await SessionService.getInstance().saveSession(userId, {
        api_key: app_key,
        api_secret: app_secret,
        session_token: sessionToken,
        user_details: cdData.Success,
      });

      // 5. Update FSM: LOGIN_INITIATED → SESSION_ACTIVE
      await query(
        `UPDATE icici_login_attempts
         SET state = 'SESSION_ACTIVE', 
             attempts = 0, 
             updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [userId]
      );

      log("ICICI connection successful for user:", userId);

      // 6. Redirect to frontend dashboard
      return res.redirect(
        `${process.env.FRONTEND_ORIGIN}/dashboard?icici_connected=true`
      );

    } catch (err: any) {
      log("Callback error:", err.message);

      // Update FSM to FAILED
      try {
        await query(
          `UPDATE icici_login_attempts
           SET state = 'FAILED', updated_at = NOW()
           WHERE state = 'LOGIN_INITIATED'`
        );
      } catch (fsmErr) {
        log("FSM update failed:", fsmErr);
      }

      return res.redirect(
        `${process.env.FRONTEND_ORIGIN}/dashboard?icici_error=${encodeURIComponent(err.message)}`
      );
    }
  }
);

export default router;
export const iciciAuthCallbackRouter = router;
