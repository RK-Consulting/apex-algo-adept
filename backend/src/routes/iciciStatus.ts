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
import crypto from "crypto";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { iciciGuard } from "../middleware/iciciGuard.js";
import { query, pool } from "../config/database.js"; // Use pool for dedicated transaction clients
import { IciciSessionFSM } from "../services/iciciSessionFSM.js";

const router = Router();
const log = debug("alphaforge:icici:broker");

/* ======================================================
   STATUS CHECK - Validates FSM + DB Session Expiry
====================================================== */
router.get(
  "/status",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    
    try {
      const state = await IciciSessionFSM.getState(userId);
      
      const creds = await query(
        `SELECT is_active, last_connected, session_expires_at 
         FROM broker_credentials 
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );

      // System-Engineering Check: Even if FSM says ACTIVE, verify timestamp
      const hasValidSession = creds.rows[0]?.is_active && 
        (!creds.rows[0]?.session_expires_at || 
         new Date(creds.rows[0].session_expires_at) > new Date());

      return res.json({
        connected: state === 'SESSION_ACTIVE' && hasValidSession,
        state: state,
        hasCredentials: (creds.rowCount ?? 0) > 0,
        lastConnected: creds.rows[0]?.last_connected || null,
        sessionExpiresAt: creds.rows[0]?.session_expires_at || null
      });
    } catch (err) {
      log("❌ Status check error:", err);
      return res.status(500).json({ error: "Failed to fetch broker status" });
    }
  }
);

/* ======================================================
   CONNECT - ATOMIC CHECK-AND-LOCK TRANSACTION
====================================================== */
router.post(
  "/connect",
  authenticateToken,
  iciciGuard("CONNECT"),
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    const requestId = crypto.randomUUID(); 
    
    // Surgical Fix: Use a dedicated client for the transaction
    const client = await pool.connect(); 
    
    try {
      await client.query('BEGIN');
      
      // 1. PESSIMISTIC LOCK: Lock the attempt row for this user specifically
      const lockResult = await client.query(
        `SELECT state, request_id, created_at 
         FROM icici_login_attempts 
         WHERE user_id = $1::uuid 
         FOR UPDATE NOWAIT`, 
        [userId]
      );

      // 2. STALE STATE REAPER
      if (lockResult.rowCount > 0) {
        const existing = lockResult.rows[0];
        const ageMinutes = (Date.now() - new Date(existing.created_at).getTime()) / 60000;
        
        if (ageMinutes > 5) {
          log("⚠️ Cleaning stale login attempt (%.1f min old)", ageMinutes);
          await client.query(`DELETE FROM icici_login_attempts WHERE user_id = $1::uuid`, [userId]);
        } else if (existing.state === 'LOGIN_INITIATED') {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: "Login in progress",
            message: "A recent login attempt is already active. Please wait or cancel.",
            existingRequestId: existing.request_id
          });
        }
      }

      // 3. CREDENTIAL VALIDATION
      const credsResult = await client.query(
        `SELECT app_key FROM broker_credentials
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );
      
      if (credsResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "ICICI credentials not configured" });
      }

      // 4. ATOMIC FSM INITIALIZATION
      await client.query(
        `INSERT INTO icici_login_attempts 
         (user_id, state, request_id, created_at, expires_at)
         VALUES ($1::uuid, 'LOGIN_INITIATED', $2, NOW(), NOW() + INTERVAL '10 minutes')
         ON CONFLICT (user_id) DO UPDATE 
         SET state = 'LOGIN_INITIATED', request_id = $2, created_at = NOW(), expires_at = NOW() + INTERVAL '10 minutes'`,
        [userId, requestId]
      );

      // 5. INVALDIATE STALE APP SESSION
      await client.query(
        `UPDATE broker_credentials 
         SET is_active = false, session_token = NULL, last_login_attempt = NOW()
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );

      await client.query('COMMIT');

      // 6. GENERATE BREEZE URL
      const appKey = credsResult.rows[0].app_key;
      const iciciUrl = `https://api.icicidirect.com/breezeapi/authenticate?api_key=${encodeURIComponent(appKey)}`;
      
      log("✅ Secure connect initiated: %s", requestId);
      
      // 7. IN-MEMORY BACKSTOP CLEANUP
      setTimeout(async () => {
        try {
          const check = await query(
            `SELECT state FROM icici_login_attempts WHERE user_id = $1::uuid AND request_id = $2`,
            [userId, requestId]
          );
          if (check.rows[0]?.state === 'LOGIN_INITIATED') {
            log("⏱️ Timeout: Force resetting request %s", requestId);
            await IciciSessionFSM.forceReset(userId);
          }
        } catch (e) { log("Cleanup err: %O", e); }
      }, 10 * 60 * 1000);
      
      return res.json({
        success: true,
        redirectUrl: iciciUrl,
        requestId,
        expiresIn: 600
      });
      
    } catch (err: any) {
      await client.query('ROLLBACK');
      
      if (err.code === '55P03') { // Postgres NOWAIT error
        return res.status(409).json({ error: "Concurrent request blocked. Try again." });
      }

      log("❌ Connect Transaction Failed: %O", err);
      return res.status(500).json({ error: "Internal server error during connection" });
    } finally {
      client.release();
    }
  }
);

/* ======================================================
   CANCEL - Explicit Cleanup
====================================================== */
router.post(
  "/cancel",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const userId = req.user!.userId;
    try {
      await IciciSessionFSM.forceReset(userId);
      return res.json({ success: true, message: "Login attempt cancelled" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to cancel" });
    }
  }
);

export { router as iciciStatusRouter };
export default router;
