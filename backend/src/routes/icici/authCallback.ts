// backend/src/routes/icici/authCallback.ts
/**
 * ICICI Breeze Authentication Callback Handler
 *
 * Supports Dual Flows for Maximum Compatibility:
 * 1. GET /auth/callback: If ICICI redirects with session_token directly (custom/older setups)
 * 2. POST /auth/complete: Standard Breeze flow — exchanges temporary apisession (API_Session)
 *    for permanent session_token via server-side CustomerDetails call (avoids CORS/403)
 *
 * Security:
 * - All endpoints JWT-protected + rate-limited
 * - Session saved via SessionService (AES-256 encrypted + Redis cache)
 * - No sensitive tokens exposed in frontend redirects
 *
 * Fixes persistent 403: CustomerDetails called server-side
 */

import { Router } from "express";
import debug from "debug";
import { AuthRequest } from "../../middleware/auth.js";
import { authenticateToken } from "../../middleware/auth.js";
import { iciciLimiter } from "../../middleware/rateLimiter.js";
import { getCustomerDetails } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js";

const router = Router();
const log = debug("alphaforge:icici:callback");

// GET: Fallback — direct session_token from ICICI redirect
router.get(
  "/auth/callback",
  iciciLimiter,
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { session_token: sessionToken, customer_details: customerDetails } = req.query;

      if (!sessionToken || typeof sessionToken !== "string") {
        log("Invalid session_token in GET callback for user %s", req.user?.userId);
        return res.status(400).json({ success: false, error: "Invalid session token from ICICI" });
      }

      const userId = req.user!.userId;

      await SessionService.getInstance().saveSession(userId, {
        session_token: sessionToken,
        // apisession intentionally omitted — temporary and not needed post-auth
        user_details: customerDetails
          ? typeof customerDetails === "string"
            ? JSON.parse(customerDetails)
            : customerDetails
          : undefined,
      });

      log("Direct ICICI session saved (GET flow) for user %s", userId);

      const frontendUrl = process.env.FRONTEND_URL || "https://alphaforge.skillsifter.in";
      const redirectUrl = `${frontendUrl}/dashboard?icici_connected=true&flow=direct`;

      return res.redirect(redirectUrl);
    } catch (error: any) {
      log("GET callback error for user %s: %s", req.user?.userId, error.message);
      return res.status(500).json({ success: false, error: "Failed to process ICICI callback" });
    }
  }
);

// POST: Recommended flow — secure server-side token exchange
router.post(
  "/auth/complete",
  iciciLimiter,
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { apisession } = req.body;
      const userId = req.user!.userId;

      if (!apisession || typeof apisession !== "string") {
        return res.status(400).json({ success: false, error: "apisession required" });
      }

      const cdData = await getCustomerDetails(userId, apisession);

      const sessionToken = cdData?.Success?.session_token;
      if (!sessionToken) {
        throw new Error("Failed to retrieve permanent session_token from CustomerDetails");
      }

      // Save only permanent data — apisession discarded after use
      await SessionService.getInstance().saveSession(userId, {
        session_token: sessionToken,
        user_details: cdData?.Success,
      });

      log("ICICI Breeze connection completed securely (POST flow) for user %s", userId);

      return res.json({
        success: true,
        message: "ICICI Breeze connected successfully!",
        flow: "complete",
      });
    } catch (error: any) {
      log("POST complete error for user %s: %s", req.user?.userId, error.message);
      return res.status(500).json({
        success: false,
        error: error.message || "ICICI connection failed",
      });
    }
  }
);

export default router;
