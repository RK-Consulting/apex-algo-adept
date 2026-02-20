// backend/src/middleware/iciciGuard.ts

/**
 * ICICI Guard Middleware - Institutional Grade
 * * Objectives:
 * 1. Connector: Ensures AI-strategies only fire if SESSION_ACTIVE.
 * 2. Aggregator: Prevents dashboard sync if session is stale/IDLE.
 * 3. Security: Handles the apisession -> session_token handshake.
 * * FSM States: IDLE -> LOGIN_INITIATED -> CALLBACK_RECEIVED -> SESSION_ACTIVE (or FAILED)
 */

import { Response, NextFunction } from "express";
import debug from "debug";
import { AuthRequest } from "./auth.js";
import { query } from "../config/database.js";
import { SessionService } from "../services/sessionService.js";

const log = debug("alphaforge:icici:guard");

export type IciciGuardMode = "LOGIN" | "CALLBACK" | "CONNECT";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MIN = 15;
const STALE_INITIATION_MIN = 10; 

export const iciciGuard =
  (mode: IciciGuardMode) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthenticated" });
    }

    try {
      /* ======================================================
          1) PROFILE & CREDENTIALS VERIFICATION
         ====================================================== */
      const profileResult = await query(
        `SELECT is_verified, is_locked FROM user_profiles WHERE user_id = $1::uuid`,
        [userId]
      );

      if (profileResult.rowCount === 0 || !profileResult.rows[0].is_verified || profileResult.rows[0].is_locked) {
        return res.status(403).json({
          success: false,
          code: "PROFILE_INVALID",
          message: "Profile not verified or locked",
        });
      }

      // ✅ FIX: Removed `AND is_active = true` — is_active tracks SESSION state,
      // not credential existence. The connect route sets is_active = false during
      // every login initiation (to invalidate the old session), which caused the
      // guard to falsely report credentials as missing on every reconnect attempt.
      // We only need to verify the credential ROW exists, not its session state.
      
      const credResult = await query(
        `SELECT id FROM broker_credentials 
         WHERE user_id = $1::uuid AND broker_name = 'ICICI', [userId]
      );

      if (credResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          code: "ICICI_CREDENTIALS_MISSING",
          message: "ICICI API credentials not configured",
        });
      }

      /* ======================================================
          2) FSM STATE LOAD & STALE CLEANUP
         ====================================================== */
      const fsmResult = await query(
        `SELECT state, attempts, locked_until, updated_at 
         FROM icici_login_attempts WHERE user_id = $1::uuid`,
        [userId]
      );

      let fsm = fsmResult.rows[0];

      // Reset stale LOGIN_INITIATED states (user closed the login popup)
      if (fsm?.state === 'LOGIN_INITIATED') {
        const lastUpdate = new Date(fsm.updated_at).getTime();
        const now = new Date().getTime();
        if (now - lastUpdate > STALE_INITIATION_MIN * 60 * 1000) {
          log("Stale initiation detected for user %s - resetting to IDLE", userId);
          await query(
            `UPDATE icici_login_attempts SET state = 'IDLE', updated_at = now() WHERE user_id = $1`,
            [userId]
          );
          fsm.state = 'IDLE';
        }
      }

      // Check for temporary lockout
      if (fsm?.locked_until && new Date(fsm.locked_until) > new Date()) {
        return res.status(423).json({
          success: false,
          code: "ICICI_LOCKED",
          message: "ICICI login temporarily locked due to too many attempts",
        });
      }

      /* ======================================================
          3) SESSION CONSISTENCY CHECK
         ====================================================== */
      const activeSession = await SessionService.getInstance().getSession(userId);
      const hasActiveSession = !!activeSession?.session_token;

      // Self-healing: If DB thinks session is active but Redis/Memory token is missing
      if (fsm?.state === "SESSION_ACTIVE" && !hasActiveSession) {
        await query(
          `UPDATE icici_login_attempts SET state = 'FAILED', updated_at = now() WHERE user_id = $1`,
          [userId]
        );
        if (fsm) fsm.state = 'FAILED';
      }

      /* ======================================================
          4) MODE-SPECIFIC ENFORCEMENT
         ====================================================== */

      if (mode === "LOGIN") {
        if (hasActiveSession) {
          return res.status(409).json({ success: false, message: "Already connected" });
        }

        const nextAttempts = (fsm?.attempts ?? 0) + 1;

        if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
          await query(
            `INSERT INTO icici_login_attempts (user_id, state, attempts, locked_until)
             VALUES ($1, 'LOCKED', $2, now() + interval '${LOCK_DURATION_MIN} minutes')
             ON CONFLICT (user_id) DO UPDATE SET state='LOCKED', attempts=$2, locked_until=EXCLUDED.locked_until`,
            [userId, nextAttempts]
          );
          return res.status(423).json({ success: false, code: "ICICI_LOCKED" });
        }

        await query(
          `INSERT INTO icici_login_attempts (user_id, state, attempts, updated_at)
           VALUES ($1, 'LOGIN_INITIATED', $2, now())
           ON CONFLICT (user_id) DO UPDATE SET state='LOGIN_INITIATED', attempts=$2, updated_at=now()`,
          [userId, nextAttempts]
        );
      }

      if (mode === "CALLBACK") {
        // Only allow progression if we recently initiated a login
        if (fsm?.state !== "LOGIN_INITIATED") {
          return res.status(400).json({
            success: false,
            code: "FSM_FLOW_ERROR",
            message: "No active login initiation found for this callback."
          });
        }
        
        // Atomically lock the state to prevent duplicate callback processing
        await query(
            `UPDATE icici_login_attempts SET state = 'CALLBACK_RECEIVED', updated_at = now() WHERE user_id = $1`,
            [userId]
        );
      }

      if (mode === "CONNECT") {
        // Enforce active session for AI Execution and Aggregator Analytics
        if (!hasActiveSession || fsm?.state !== "SESSION_ACTIVE") {
          return res.status(412).json({ 
            success: false, 
            code: "ICICI_NOT_CONNECTED",
            message: "ICICI session not active. Please reconnect." 
          });
        }
      }

      // If all checks pass, move to the controller
      next();
    } catch (err: any) {
      log("ICICI guard failure: %s", err.message);
      return res.status(500).json({ success: false, error: "Security Guard Error" });
    }
  };
