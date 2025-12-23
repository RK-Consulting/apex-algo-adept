// backend/src/routes/icici/authCallback.ts
// backend/src/routes/icici/authCallback.ts
/**
 * ICICI Breeze Authentication Callback Handler
 *
 * Supports Dual Flows for Maximum Compatibility:
 * 1. GET /auth/callback: If ICICI redirects with session_token directly (legacy/custom)
 * 2. POST /auth/complete: Secure Breeze flow — apisession exchanged server-side
 *
 * Security:
 * - JWT protected
 * - Rate limited
 * - FSM guarded (login must be initiated)
 * - No secrets exposed to frontend
 */

import { Router } from "express";
import debug from "debug";
import { AuthRequest, authenticateToken } from "../../middleware/auth.js";
import { iciciGuard } from "../../middleware/iciciGuard.js";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { getCustomerDetails } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

/* ============================================================
   GET /api/icici/auth/callback
   Fallback — direct session_token from ICICI redirect
============================================================ */
router.get(
  "/auth/callback",
  iciciLimiter,
  authenticateToken,
  iciciGuard({
    requireLoginInitiated: true,
    requireActiveSession: false,
  }),
  async (req: AuthRequest, res) => {
    try {
      const {
        session_token: sessionToken,
        customer_details: customerDetails,
      } = req.query;

      if (!sessionToken || typeof sessionToken !== "string") {
        log(
          "Invalid session_token in GET callback for user %s",
          req.user?.userId
        );
        return res.status(400).json({
          success: false,
          error: "Invalid session token from ICICI",
        });
      }

      const userId = req.user!.userId;

      await SessionService.getInstance().saveSession(userId, {
        session_token: sessionToken,
        user_details: customerDetails
          ? typeof customerDetails === "string"
            ? JSON.parse(customerDetails)
            : customerDetails
          : undefined,
      });

      log("ICICI session saved via GET callback for user %s", userId);

      const frontendUrl =
        process.env.FRONTEND_URL || "https://alphaforge.skillsifter.in";

      return res.redirect(
        `${frontendUrl}/dashboard?icici_connected=true&flow=direct`
      );
    } catch (error: any) {
      log(
        "GET callback error for user %s: %s",
        req.user?.userId,
        error.message
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
   Recommended secure server-side exchange
============================================================ */
router.post(
  "/auth/complete",
  iciciLimiter,
  authenticateToken,
  iciciGuard({
    requireLoginInitiated: true,
    requireActiveSession: false,
  }),
  async (req: AuthRequest, res) => {
    try {
      const { apisession } = req.body;
      const userId = req.user!.userId;

      if (!apisession || typeof apisession !== "string") {
        return res.status(400).json({
          success: false,
          error: "apisession required",
        });
      }

      const cdData = await getCustomerDetails(userId, apisession);
      const sessionToken = cdData?.Success?.session_token;

      if (!sessionToken) {
        throw new Error("Failed to retrieve permanent session_token");
      }

      await SessionService.getInstance().saveSession(userId, {
        session_token: sessionToken,
        user_details: cdData?.Success,
      });

      log("ICICI Breeze connected successfully for user %s", userId);

      return res.json({
        success: true,
        message: "ICICI Breeze connected successfully",
        flow: "complete",
      });
    } catch (error: any) {
      log(
        "POST complete error for user %s: %s",
        req.user?.userId,
        error.message
      );
      return res.status(500).json({
        success: false,
        error: error.message || "ICICI connection failed",
      });
    }
  }
);

export default router;
