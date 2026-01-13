// backend/src/middleware/iciciGuard.ts

/**
 * ICICI Guard Middleware
 *
 * Enforces ICICI connection finite-state machine (FSM)
 * Ensures multi-user isolation and prevents session race conditions.
 *
 * FSM States: IDLE -> LOGIN_INITIATED -> SESSION_ACTIVE (or FAILED)
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
const STALE_INITIATION_MIN = 10; // State expires if no callback received in 10 mins

export const iciciGuard =
  (mode: IciciGuardMode) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthenticated",
      });
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

      const credResult = await query(
        `SELECT id FROM broker_credentials 
         WHERE user_id = $1::uuid AND broker_name = 'ICICI' AND is_active = true`,
        [userId]
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

      // Handle Stale 'LOGIN_INITIATED' state (prevent permanent lockout if user closes popup)
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

      // Force FSM back to FAILED if DB thinks it's active but Redis/Memory session is gone
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

      /* ---------- LOGIN (Initiating the process) ---------- */
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

        // Transition to INITIATED
        await query(
          `INSERT INTO icici_login_attempts (user_id, state, attempts, updated_at)
           VALUES ($1, 'LOGIN_INITIATED', 1, now())
           ON CONFLICT (user_id) DO UPDATE SET state='LOGIN_INITIATED', attempts=$2, updated_at=now()`,
          [userId, nextAttempts]
        );
      }

      /* ---------- CALLBACK (ICICI calling us back) ---------- */
      if (mode === "CALLBACK") {
        // We MUST allow LOGIN_INITIATED to pass through to the actual logic
        if (fsm?.state !== "LOGIN_INITIATED") {
          return res.status(400).json({
            success: false,
            code: "FSM_FLOW_ERROR",
            message: "No active login initiation found for this callback."
          });
        }
      }

      /* ---------- CONNECT (General Check) ---------- */
      if (mode === "CONNECT") {
        if (hasActiveSession) {
          return res.json({ success: true, connected: true, message: "Connected" });
        }
      }

      next();
    } catch (err: any) {
      log("ICICI guard failure: %s", err.message);
      return res.status(500).json({ success: false, error: "Security Guard Error" });
    }
  };
