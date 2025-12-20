// backend/src/routes/icici/authLogin.ts

/**
 * ICICI OAuth Login Initiator
 *
 * Responsibility:
 * - Redirect authenticated user to ICICI login page
 * - Fetches ONLY app_key from broker_credentials
 * - Does NOT decrypt, store, or expose secrets
 *
 * Naming Discipline:
 * - DB layer     → app_key
 * - Server layer → serverAppKey
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { query } from "../../config/database.js";
import debug from "debug";

const log = debug("alphaforge:icici:login");
const router = Router();

/**
 * GET /api/icici/auth/login
 * Initiates ICICI Breeze OAuth login
 */
router.get(
  "/auth/login",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      /* ------------------------------
         SERVER CONTEXT
      ------------------------------ */
      const serverUserId = req.user!.userId;
      const serverBrokerName = "ICICI";

      /* ------------------------------
         DB LOOKUP (NO SECRETS)
      ------------------------------ */
      const dbResult = await query(
        `
        SELECT app_key
        FROM broker_credentials
        WHERE user_id = $1
          AND broker_name = $2
          AND is_active = true
        `,
        [serverUserId, serverBrokerName]
      );

      if ((dbResult.rowCount ?? 0) === 0) {
        return res.status(400).json({
          success: false,
          error: "ICICI API key not configured for user",
        });
      }

      /* ------------------------------
         DB → SERVER MATERIALIZATION
      ------------------------------ */
      const serverAppKey: string = dbResult.rows[0].app_key;

      /* ------------------------------
         REDIRECT
      ------------------------------ */
      const loginUrl =
        "https://api.icicidirect.com/apiuser/login?api_key=" +
        encodeURIComponent(serverAppKey);

      log("Redirecting user %s to ICICI login", serverUserId);
      return res.redirect(loginUrl);
    } catch (err: any) {
      log("ICICI login init failed: %s", err.message);
      return res.status(500).json({
        success: false,
        error: "Failed to initiate ICICI login",
      });
    }
  }
);

export const iciciAuthLoginRouter = router;
export default router;
