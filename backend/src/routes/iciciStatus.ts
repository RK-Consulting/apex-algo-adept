// apex-algo-adept/backend/src/routes/iciciStatus.ts
/**
 * ICICI STATUS ROUTER — System-Engineering–Correct
 *
 * Provides:
 * - Whether ICICI broker credentials exist (DB-level)
 * - Whether an active Breeze session exists (server/runtime)
 *
 * Guarantees:
 * - No secrets exposed
 * - No session tokens exposed
 * - broker_credentials is the SINGLE source of truth
 *
 * Naming Discipline:
 * - DB layer     → app_key / app_secret
 * - Server layer → server*
 * - Runtime      → SessionService only
 */
// backend/src/routes/iciciStatus.ts

import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { iciciGuard } from "../middleware/iciciGuard.js";
import { query } from "../config/database.js";
import { IciciSessionFSM } from "../services/iciciSessionFSM.js";

const router = Router();
const log = debug("alphaforge:icici:broker");

/* ======================================================
   1) CHECK ICICI CONNECTION STATUS
   ====================================================== */
router.get(
  "/status",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    
    try {
      const state = await IciciSessionFSM.getState(userId);
      
      const creds = await query(
        `SELECT is_active, last_connected FROM broker_credentials 
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );

      return res.json({
        connected: state === 'SESSION_ACTIVE',
        state: state, 
        hasCredentials: (creds.rowCount ?? 0) > 0,
        lastConnected: creds.rows[0]?.last_connected || null
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch broker status" });
    }
  }
);

/* ======================================================
   2) CONNECT - HANDLES FSM TRANSITION & URL GENERATION
   ====================================================== */
router.post(
  "/connect",
  authenticateToken,
  iciciGuard("CONNECT"), 
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    try {
      const credsResult = await query(
        `SELECT app_key FROM broker_credentials
         WHERE user_id = $1::uuid AND broker_name = 'ICICI' AND is_active = true`,
        [userId]
      );
      
      if (credsResult.rowCount === 0) {
        return res.status(400).json({
          error: "ICICI credentials not found. Please setup your API keys first.",
        });
      }

      // Transition FSM to prevent race conditions
      await IciciSessionFSM.transition(userId, 'LOGIN_INITIATED');

      /* ======================================================
         SURGICAL FIX: INLINED URL GENERATION
         Replaces the missing 'getBreezeLoginUrl' function call
         ====================================================== */
      const appKey = credsResult.rows[0].app_key;
      const iciciUrl = `https://api.icicidirect.com/breezeapi/authenticate?api_key=${encodeURIComponent(appKey)}`;
      
      log("✅ FSM set to LOGIN_INITIATED for user %s", userId);
      
      return res.json({
        success: true,
        redirectUrl: iciciUrl,
        message: "Redirecting to ICICI Direct login"
      });
      
    } catch (err: any) {
      log("❌ Connect error:", err.message);
      return res.status(500).json({ 
        error: err.message || "Connection failed. Please try again." 
      });
    }
  }
);

export { router as iciciStatusRouter };
export default router;
