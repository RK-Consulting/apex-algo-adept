// /backend/src/routes/iciciBroker.ts
/**
 * ICICI Broker Routes — Aligned with System Architecture
 *
 * Responsibilities:
 * - ICICI-specific broker checks
 * - Connection readiness validation
 * - Store and validate ICICI credentials with session token
 */
import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { iciciGuard } from "../middleware/iciciGuard.js";
import { query } from "../config/database.js";
import { encryptCredentials } from "../utils/encryption.js";
import BreezeConnect from "breezeconnect";

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
   2) STORE CREDENTIALS AND CONNECT (NEW - FOR DIALOG FLOW)
   ====================================================== */
router.post(
  "/connect-with-credentials",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const { api_key, api_secret, session_token } = req.body;

    try {
      // Validation
      if (!api_key || !api_secret || !session_token) {
        return res.status(400).json({
          error: "API Key, API Secret, and Session Token are required"
        });
      }

      // Test connection with Breeze
      const breeze = new BreezeConnect({ appKey: api_key });
      breeze.generateSession(api_secret, session_token);

      // Encrypt credentials
      const encryptedKey = encryptCredentials(api_key);
      const encryptedSecret = encryptCredentials(api_secret);
      const encryptedSession = encryptCredentials(session_token);

      // Store in database
      await query(
        `INSERT INTO broker_credentials 
         (user_id, broker_name, app_key, app_secret, session_token, is_active, last_connected)
         VALUES ($1::uuid, 'ICICI', $2, $3, $4, true, NOW())
         ON CONFLICT (user_id, broker_name)
         DO UPDATE SET 
           app_key = $2,
           app_secret = $3,
           session_token = $4,
           is_active = true,
           last_connected = NOW()`,
        [userId, encryptedKey, encryptedSecret, encryptedSession]
      );

      log("✅ ICICI credentials stored for user:", userId);

      return res.json({
        success: true,
        message: "ICICI Direct connected successfully"
      });

    } catch (err: any) {
      log("❌ Connect error:", err);
      return res.status(500).json({
        error: err.message || "Failed to connect to ICICI Direct"
      });
    }
  }
);

/* ======================================================
   3) ORIGINAL CONNECT ENTRYPOINT (REDIRECT FLOW - KEEP FOR BACKWARD COMPATIBILITY)
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
