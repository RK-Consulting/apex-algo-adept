// backend/src/middleware/iciciGuard.ts

/**
 * ICICI Guard Middleware - Institutional Grade
 *
 * FSM States: IDLE -> LOGIN_INITIATED -> CALLBACK_RECEIVED -> SESSION_ACTIVE (or FAILED)
 *
 * ROOT CAUSE FIX (ICICI Account Lockout):
 * The `attempts` counter was previously incremented on every Connect button click.
 * This meant each click → new ICICI login page → user enters credentials + OTP →
 * ICICI counts that as a login attempt on their end. After enough cycles, ICICI
 * locks the real account. Our internal lock (MAX_LOGIN_ATTEMPTS=5) fired too, making
 * it look like our app was the problem.
 *
 * Fix: Guard NEVER increments `attempts`. It only transitions state to LOGIN_INITIATED.
 * `attempts` is incremented ONLY in authCallback.ts when the ICICI apisession
 * exchange actually fails. Reset to 0 only on success.
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

      if (
        profileResult.rowCount === 0 ||
        !profileResult.rows[0].is_verified ||
        profileResult.rows[0].is_locked
      ) {
        return res.status(403).json({
          success: false,
          code: "PROFILE_INVALID",
          message: "Profile not verified or locked",
        });
      }

      // Credential row existence check only — no is_active filter.
      // connect route sets is_active=false during login initiation; the row still exists.
      const credResult = await query(
        `SELECT id FROM broker_credentials
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
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

      // Reset stale LOGIN_INITIATED (user closed popup before completing OTP)
      if (fsm?.state === "LOGIN_INITIATED") {
        const ageMs = Date.now() - new Date(fsm.updated_at).getTime();
        if (ageMs > STALE_INITIATION_MIN * 60 * 1000) {
          log("Stale initiation detected for user %s - resetting to IDLE", userId);
          await query(
            `UPDATE icici_login_attempts SET state = 'IDLE', updated_at = now() WHERE user_id = $1`,
            [userId]
          );
          fsm.state = "IDLE";
        }
      }

      // Check for lockout — set by authCallback when attempts >= MAX_LOGIN_ATTEMPTS
      if (fsm?.locked_until && new Date(fsm.locked_until) > new Date()) {
        return res.status(423).json({
          success: false,
          code: "ICICI_LOCKED",
          message: `ICICI login locked due to too many failed attempts. Try again after ${new Date(fsm.locked_until).toLocaleTimeString()}.`,
        });
      }

      /* ======================================================
          3) SESSION CONSISTENCY CHECK
         ====================================================== */
      const activeSession = await SessionService.getInstance().getSession(userId);
      const hasActiveSession = !!activeSession?.session_token;

      // Self-healing: FSM says active but session token is gone (Redis expired, DB empty)
      if (fsm?.state === "SESSION_ACTIVE" && !hasActiveSession) {
        log("Self-heal: SESSION_ACTIVE with no token for user %s — resetting to FAILED", userId);
        await query(
          `UPDATE icici_login_attempts SET state = 'FAILED', updated_at = now() WHERE user_id = $1`,
          [userId]
        );
        if (fsm) fsm.state = "FAILED";
      }

      /* ======================================================
          4) MODE-SPECIFIC ENFORCEMENT
         ====================================================== */
      if (mode === "LOGIN") {
        if (hasActiveSession) {
          return res.status(409).json({ success: false, message: "Already connected" });
        }

        // IMPORTANT: Do NOT increment attempts here.
        // attempts is only ever incremented in authCallback on exchange failure.
        // Incrementing here would lock the account every 5 Connect button clicks,
        // even when the user never even reaches the OTP screen.
        await query(
          `INSERT INTO icici_login_attempts (user_id, state, updated_at)
           VALUES ($1, 'LOGIN_INITIATED', now())
           ON CONFLICT (user_id) DO UPDATE
           SET state = 'LOGIN_INITIATED', updated_at = now()`,
          [userId]
        );
      }

      if (mode === "CALLBACK") {
        if (fsm?.state !== "LOGIN_INITIATED") {
          return res.status(400).json({
            success: false,
            code: "FSM_FLOW_ERROR",
            message: "No active login initiation found for this callback.",
          });
        }
        await query(
          `UPDATE icici_login_attempts SET state = 'CALLBACK_RECEIVED', updated_at = now() WHERE user_id = $1`,
          [userId]
        );
      }

      if (mode === "CONNECT") {
        if (!hasActiveSession || fsm?.state !== "SESSION_ACTIVE") {
          return res.status(412).json({
            success: false,
            code: "ICICI_NOT_CONNECTED",
            message: "ICICI session not active. Please reconnect.",
          });
        }
      }

      next();
    } catch (err: any) {
      log("ICICI guard failure: %s", err.message);
      return res.status(500).json({ success: false, error: "Security Guard Error" });
    }
  };
