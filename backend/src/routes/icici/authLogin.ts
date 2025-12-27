// /backend/src/routes/icici/authLogin.ts

/**
 * ICICI OAuth Login Initiator
 *
 * Responsibility:
 * - Authenticated initiation of ICICI login
 * - Fetches ONLY app_key from broker_credentials
 * - Does NOT handle browser redirect
 * - Does NOT mutate FSM directly (guard is source of truth)
 *
 * Naming Discipline:
 * - DB layer     → app_key
 * - Server layer → serverAppKey
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { iciciGuard } from "../../middleware/iciciGuard.js";
import { query } from "../../config/database.js";
import debug from "debug";

const log = debug("alphaforge:icici:login");
const router = Router();

/**
 * POST /api/icici/auth/login
 * Returns ICICI redirect URL (frontend performs navigation)
 */
router.post(
  "/login",
  authenticateToken,
  iciciGuard("LOGIN"),
  async (req: AuthRequest, res) => {
    const serverUserId = req.user!.userId;
    const serverBrokerName = "ICICI";

    try {
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
         ICICI LOGIN URL CONSTRUCTION
      ------------------------------ */
      const redirectUrl =
        "https://api.icicidirect.com/apiuser/login?api_key=" +
        encodeURIComponent(serverAppKey);

      log("ICICI login initiated for user %s", serverUserId);

      return res.json({
        success: true,
        redirectUrl,
      });
    } catch (err: any) {
      log("ICICI login init failed for user %s: %s", serverUserId, err.message);

      return res.status(500).json({
        success: false,
        error: "Failed to initiate ICICI login",
      });
    }
  }
);

export const iciciAuthLoginRouter = router;
export default router;
