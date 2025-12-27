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
import { AuthRequest } from "../../middleware/auth.js";
import { iciciGuard } from "../../middleware/iciciGuard.js";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { getCustomerDetails } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js";
import { query } from "../../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

/* ============================================================
   GET /api/icici/auth/callback
   Legacy flow — browser redirect (NO JWT POSSIBLE)
============================================================ */
router.get(
  "/callback",
  iciciLimiter,
  iciciGuard("CALLBACK"),
  async (req, res) => {
    try {
      const { session_token, customer_details } = req.query;

      if (!session_token || typeof session_token !== "string") {
        return res.status(400).json({
          success: false,
          error: "Invalid session token from ICICI",
        });
      }

      /* ------------------------------
         RESOLVE USER FROM FSM CONTEXT
      ------------------------------ */
      const fsmResult = await query(
        `
        SELECT user_id
        FROM icici_login_attempts
        WHERE state = 'LOGIN_INITIATED'
        ORDER BY updated_at DESC
        LIMIT 1
        `
      );

      if (fsmResult.rowCount === 0) {
        return res.status(409).json({
          success: false,
          error: "No active ICICI login session found",
        });
      }

      const userId: string = fsmResult.rows[0].user_id;

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

      /* ------------------------------
         SAFE CUSTOMER DETAILS PARSE
      ------------------------------ */
      let parsedCustomerDetails: any = undefined;
      if (typeof customer_details === "string") {
        try {
          parsedCustomerDetails = JSON.parse(customer_details);
        } catch {
          log("Non-JSON customer_details for user %s", userId);
        }
      }

      await SessionService.getInstance().saveSession(userId, {
        session_token,
        user_details: parsedCustomerDetails,
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

      const frontendUrl =
        process.env.FRONTEND_URL || "https://alphaforge.skillsifter.in";

      return res.redirect(
        `${frontendUrl}/dashboard?icici_connected=true&flow=direct`
      );
    } catch (err: any) {
      log("GET callback error: %s", err.message);

      return res.status(500).json({
        success: false,
        error: "Failed to process ICICI callback",
      });
    }
  }
);

/* ============================================================
   POST /api/icici/auth/complete
   Secure server-side exchange (JWT OK)
============================================================ */
router.post(
  "/complete",
  iciciLimiter,
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
        flow: "complete",
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
