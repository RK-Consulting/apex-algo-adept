// backend/src/routes/iciciAuth.ts

import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { SessionService } from "../services/sessionService.js";
import { getCustomerDetails } from "../services/breezeClient.js";

const log = debug("apex:icici:auth");
const router = Router();

/**
 * ============================================================================
 * GET /api/icici/auth/login
 * ----------------------------------------------------------------------------
 * PUBLIC endpoint
 * Redirects browser popup to ICICI Direct login page
 * ============================================================================
 */
router.get("/auth/login", (req, res) => {
  try {
    const apiKey = String(
      req.query.api_key || process.env.DEFAULT_ICICI_APPKEY || ""
    ).trim();

    if (!apiKey) {
      log("Missing api_key in /auth/login");
      return res.status(400).send("Missing api_key");
    }

    const loginUrl =
      `https://api.icicidirect.com/apiuser/login?api_key=` +
      encodeURIComponent(apiKey);

    log("Redirecting to ICICI login");
    return res.redirect(loginUrl);
  } catch (err) {
    log("Error in /auth/login", err);
    return res.status(500).send("ICICI Login Redirect Failed");
  }
});

/**
 * ============================================================================
 * GET /api/icici/auth/callback
 * ----------------------------------------------------------------------------
 * PUBLIC popup callback
 * Sends apisession to opener via postMessage
 * ============================================================================
 */
router.get("/auth/callback", (req, res) => {
  const apisession = String(req.query.apisession || "").trim();

  if (!apisession) {
    return res.send(`
      <html><body>
        <script>
          if (window.opener) {
            window.opener.postMessage(
              { type: "ICICI_LOGIN_ERROR", error: "Missing apisession" },
              "*"
            );
            window.close();
          }
        </script>
      </body></html>
    `);
  }

  return res.send(`
    <html><body>
      <script>
        if (window.opener) {
          window.opener.postMessage(
            { type: "ICICI_LOGIN", apisession: "${apisession}" },
            "*"
          );
          window.close();
        }
      </script>
    </body></html>
  `);
});

/**
 * ============================================================================
 * POST /api/icici/auth/callback
 * ----------------------------------------------------------------------------
 * AUTHENTICATED
 * Exchanges apisession → Breeze session_token
 * Persists session via SessionService
 * ============================================================================
 */
router.post(
  "/auth/callback",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { apisession } = req.body;

      if (!apisession) {
        return res.status(400).json({ error: "Missing apisession" });
      }

      // 1️⃣ Call ICICI CustomerDetails to get Breeze session_token
      const customer = await getCustomerDetails(userId, apisession);

      if (!customer?.session_token) {
        throw new Error("Failed to obtain Breeze session_token");
      }

      // 2️⃣ Persist session (WRITE — not READ)
      await SessionService.getInstance().saveSession(userId, {
        session_token: customer.session_token,
        user_details: customer,
      });

      log("ICICI session established for user %s", userId);

      return res.json({
        success: true,
      });
    } catch (err: any) {
      log("POST /auth/callback failed", err);
      return res.status(500).json({
        error: err.message || "ICICI callback processing failed",
      });
    }
  }
);

export const iciciAuthRouter = router;
export default router;
