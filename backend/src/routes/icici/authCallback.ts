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
router.get(
  "/callback",
  iciciLimiter,
  async (req, res) => {
    const { apisession } = req.query;

    if (!apisession || typeof apisession !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing apisession from ICICI",
      });
    }

    const frontendUrl =
      process.env.FRONTEND_URL || "https://alphaforge.skillsifter.in";

    // Pass apisession to frontend popup safely
    return res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage(
              { type: "ICICI_LOGIN", apisession: "${apisession}" },
              "${frontendUrl}"
            );
            window.close();
          </script>
        </body>
      </html>
    `);
  }
);

/* ============================================================
   POST /api/icici/auth/complete
   JWT REQUIRED — FINALIZES LOGIN
============================================================ */
router.post(
  "/complete",
  iciciLimiter,
  authenticateToken,
  iciciGuard("CALLBACK"),
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;

    try {
      const { apisession } = req.body;

      if (!apisession || typeof apisession !== "string") {
        return res.status(400).json({
          success: false,
          error: "apisession required",
        });
      }

      /* FSM → CALLBACK_RECEIVED */
      await query(
        `
        UPDATE icici_login_attempts
        SET state = 'CALLBACK_RECEIVED',
            updated_at = now()
        WHERE user_id = $1
        `,
        [userId]
      );

      /* Breeze exchange */
      const cdData = await getCustomerDetails(userId, apisession);
      const sessionToken = cdData?.Success?.session_token;

      if (!sessionToken) {
        throw new Error("Failed to retrieve session_token from Breeze");
      }

      await SessionService.getInstance().saveSession(userId, {
        session_token: sessionToken,
        user_details: cdData.Success,
      });

      /* FSM → SESSION_ACTIVE */
      await query(
        `
        UPDATE icici_login_attempts
        SET state = 'SESSION_ACTIVE',
            attempts = 0,
            updated_at = now()
        WHERE user_id = $1
        `,
        [userId]
      );

      return res.json({
        success: true,
        message: "ICICI Breeze connected successfully",
      });
    } catch (err: any) {
      log("POST complete error for user %s: %s", userId, err.message);

      await query(
        `
        UPDATE icici_login_attempts
        SET state = 'FAILED',
            updated_at = now()
        WHERE user_id = $1
        `,
        [userId]
      );

      return res.status(500).json({
        success: false,
        error: "ICICI connection failed",
      });
    }
  }
);

export default router;
