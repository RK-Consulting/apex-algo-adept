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

import { Router } from "express";
import debug from "debug";
import { AuthRequest, authenticateToken } from "../../middleware/auth.js";
import { iciciGuard } from "../../middleware/iciciGuard.js";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { getCustomerDetails } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js";
import { query } from "../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

/* ============================================================
   GET /api/icici/auth/callback
   Legacy flow — direct session_token
============================================================ */
router.get(
  "/auth/callback",
  iciciLimiter,
  authenticateToken,
  iciciGuard("CALLBACK"),
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;

    try {
      const {
        session_token: sessionToken,
        customer_details: customerDetails,
      } = req.query;

      if (!sessionToken || typeof sessionToken !== "string") {
        log("Invalid session_token in GET callback for user %s", userId);
        return res.status(400).json({
          success: false,
          error: "Invalid session token from ICICI",
        });
      }

      /* ------------------------------
         FSM → CALLBACK_RECEIVED
      ------------------------------ */
      await query(
        `
        UPDATE icici_login_attempts
        SET state = 'CALLBACK_RECEIVED',
            updated_at = now()
        WHERE user_id = $1
        `,
        [userId]
      );

      await SessionService.getInstance().saveSession(userId, {
        session_token: sessionToken,
        user_details: customerDetails
          ? typeof customerDetails === "string"
            ? JSON.parse(customerDetails)
            : customerDetails
          : undefined,
      });

      /* ------------------------------
         FSM → SESSION_ACTIVE
      ------------------------------ */
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

      log("ICICI session established via GET callback for user %s", userId);

      const frontendUrl =
        process.env.FRONTEND_URL || "https://alphaforge.skillsifter.in";

      return res.redirect(
        `${frontendUrl}/dashboard?icici_connected=true&flow=direct`
      );
    } catch (error: any) {
      log("GET callback error for user %s: %s", userId, error.message);

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
        error: "Failed to process ICICI callback",
      });
    }
  }
);

/* ============================================================
   POST /api/icici/auth/complete
   Secure server-side exchange
============================================================ */
router.post(
  "/auth/complete",
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

      /* ------------------------------
         FSM → CALLBACK_RECEIVED
      ------------------------------ */
      await query(
        `
        UPDATE icici_login_attempts
        SET state = 'CALLBACK_RECEIVED',
            updated_at = now()
        WHERE user_id = $1
        `,
        [userId]
      );

      const cdData = await getCustomerDetails(userId, apisession);
      const sessionToken = cdData?.Success?.session_token;

      if (!sessionToken) {
        throw new Error("Failed to retrieve permanent session_token");
      }

      await SessionService.getInstance().saveSession(userId, {
        session_token: sessionToken,
        user_details: cdData?.Success,
      });

      /* ------------------------------
         FSM → SESSION_ACTIVE
      ------------------------------ */
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

      log("ICICI Breeze connected successfully for user %s", userId);

      return res.json({
        success: true,
        message: "ICICI Breeze connected successfully",
        flow: "complete",
      });
    } catch (error: any) {
      log("POST complete error for user %s: %s", userId, error.message);

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
        error: error.message || "ICICI connection failed",
      });
    }
  }
);

export default router;
