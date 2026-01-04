// /backend/src/routes/iciciBroker.ts

/**
 * ICICI Broker Routes — Aligned with System Architecture
 *
 * Responsibilities:
 * - ICICI-specific broker checks
 * - Connection readiness validation
 *
 * Explicitly DOES NOT:
 * - Store credentials
 * - Encrypt / decrypt secrets
 * - Handle sessions or apisession
 *
 * Single Source of Truth:
 * - broker_credentials table
 * - /api/credentials routes
 */

import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { iciciGuard } from "../middleware/iciciGuard.js";
import { query } from "../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:broker");

/* ======================================================
   1) CHECK ICICI CONNECTION STATUS
   ====================================================== */
router.get(
  "/status",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const serverUserId = req.user!.userId;
    const serverBrokerName = "ICICI";

    const dbResult = await query(
      `
      SELECT is_active, last_connected, created_at
      FROM broker_credentials
      WHERE user_id = $1::uuid
        AND broker_name = $2::uuid
      `,
      [serverUserId, serverBrokerName]
    );

    if ((dbResult.rowCount ?? 0) === 0) {
      return res.json({
        connected: false,
        broker: serverBrokerName,
      });
    }

    return res.json({
      connected: true,
      broker: serverBrokerName,
      ...dbResult.rows[0],
    });
  }
);

/* ======================================================
   2) CONNECT ENTRYPOINT (GUARDED)
   ====================================================== */
router.post(
  "/connect",
  authenticateToken,
  iciciGuard("CONNECT"),
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;

    try {
      // Get ICICI credentials
      const credsResult = await query(
        `SELECT app_key FROM broker_credentials
         WHERE user_id = $1::uuid 
           AND broker_name = 'ICICI' 
           AND is_active = true`,
        [userId]
      );

      if (credsResult.rowCount === 0) {
        return res.status(400).json({
          error: "ICICI API key not configured",
        });
      }

      // Insert login attempt (FSM: IDLE → LOGIN_INITIATED)
      await query(
        `INSERT INTO icici_login_attempts (user_id, state, updated_at)
         VALUES ($1::uuid, 'LOGIN_INITIATED', NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET state = 'LOGIN_INITIATED', updated_at = NOW()`,
        [userId]
      );

      // Redirect to ICICI
      const iciciUrl = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(credsResult.rows[0].app_key)}`;
      
      log("Redirecting user %s to ICICI", userId);
      return res.redirect(iciciUrl);
      
    } catch (err: any) {
      log("Connect error:", err);
      return res.status(500).json({ error: "Connection failed" });
    }
  }
);
export { router as iciciBrokerRouter };
export default router;
