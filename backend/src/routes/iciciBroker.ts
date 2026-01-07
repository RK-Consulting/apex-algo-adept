// /backend/src/routes/iciciBroker.ts
/**
 * ICICI Broker Routes — Aligned with System Architecture
 *
 * Responsibilities:
 * - ICICI-specific broker checks
 * - Connection readiness validation
 * - Uses credentials stored in broker_credentials table
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
        AND broker_name = $2
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
   2) CONNECT - REDIRECTS TO ICICI USING STORED CREDENTIALS
   ====================================================== */
router.post(
  "/connect",
  authenticateToken,
  iciciGuard("CONNECT"),
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    try {
      // Get ICICI credentials from database
      const credsResult = await query(
        `SELECT app_key FROM broker_credentials
         WHERE user_id = $1::uuid 
           AND broker_name = 'ICICI' 
           AND is_active = true`,
        [userId]
      );
      
      if (credsResult.rowCount === 0) {
        return res.status(400).json({
          error: "ICICI credentials not found. Please contact support to set up your API credentials.",
        });
      }

      // Insert/update login attempt (FSM: IDLE → LOGIN_INITIATED)
      await query(
        `INSERT INTO icici_login_attempts (user_id, state, updated_at)
         VALUES ($1::uuid, 'LOGIN_INITIATED', NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET state = 'LOGIN_INITIATED', updated_at = NOW()`,
        [userId]
      );

      // Build ICICI login URL
      const iciciUrl = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(credsResult.rows[0].app_key)}`;
      
      log("✅ Redirecting user %s to ICICI login", userId);
      
      // Return redirect URL to frontend
      return res.json({
        success: true,
        redirectUrl: iciciUrl,
        message: "Redirecting to ICICI Direct login"
      });
      
    } catch (err: any) {
      log("❌ Connect error:", err);
      return res.status(500).json({ 
        error: "Connection failed. Please try again." 
      });
    }
  }
);

export { router as iciciBrokerRouter };
export default router;
