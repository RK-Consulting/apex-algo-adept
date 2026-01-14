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
// backend/src/routes/iciciBroker.ts

import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { iciciGuard } from "../middleware/iciciGuard.js";
import { query } from "../config/database.js";
import { IciciSessionFSM } from "../services/iciciSessionFSM.js"; // Import FSM
import { getBreezeLoginUrl } from "../services/iciciBreezeApi.js"; // Use centralized URL generator

const router = Router();
const log = debug("alphaforge:icici:broker");

/* ======================================================
   1) CHECK ICICI CONNECTION STATUS
   Surgical Fix: Returns FSM State + Readiness
   ====================================================== */
router.get(
  "/status",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    
    try {
      // 1. Get current FSM state
      const state = await IciciSessionFSM.getState(userId);
      
      // 2. Get static credential status
      const creds = await query(
        `SELECT is_active, last_connected FROM broker_credentials 
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );

      return res.json({
        connected: state === 'SESSION_ACTIVE',
        state: state, // IDLE, LOGIN_INITIATED, SESSION_ACTIVE, etc.
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
  iciciGuard("CONNECT"), // Ensure state allows starting a login
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    try {
      // 1. Get Credentials
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

      // 2. FSM TRANSITION: Move to LOGIN_INITIATED
      // This protects the system from "Callback Race Conditions"
      await IciciSessionFSM.transition(userId, 'LOGIN_INITIATED');

      // 3. Generate URL using the service utility
      const iciciUrl = getBreezeLoginUrl(credsResult.rows[0].app_key);
      
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

export { router as iciciBrokerRouter };
export default router;
