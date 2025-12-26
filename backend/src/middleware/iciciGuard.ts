// backend/src/middleware/iciciGuard.ts

/**
 * ICICI Guard Middleware
 *
 * Enforces ICICI connection finite-state machine
 * Prevents OAuth / callback bombardment
 *
 * Guards:
 * - /api/icici/auth/login     → LOGIN
 * - /api/icici/auth/callback  → CALLBACK
 * - /api/icici/broker/connect → CONNECT
 *
 * FSM Source of Truth:
 * - icici_login_attempts
 */

import { Response, NextFunction } from "express";
import debug from "debug";
import { AuthRequest } from "./auth.js";
import { query } from "../config/database.js";
// import type { IciciGuardMode } from "../types/icici.js";
import { SessionService } from "../services/sessionService.js";

const log = debug("alphaforge:icici:guard");

export type IciciGuardMode = "LOGIN" | "CALLBACK" | "CONNECT";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MIN = 15;

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
         1) PROFILE VERIFICATION & LOCK CHECK
         ====================================================== */
      const profileResult = await query(
        `
        SELECT is_verified, is_locked
        FROM user_profiles
        WHERE user_id = $1
        `,
        [userId]
      );

      if (profileResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          code: "PROFILE_MISSING",
          message: "User profile not created",
        });
      }

      const profile = profileResult.rows[0];

      if (!profile.is_verified || profile.is_locked) {
        return res.status(403).json({
          success: false,
          code: "PROFILE_NOT_VERIFIED",
          message: "Profile not verified or locked",
        });
      }

      /* ======================================================
         2) ICICI CREDENTIALS CHECK
         ====================================================== */
      const credResult = await query(
        `
        SELECT id
        FROM broker_credentials
        WHERE user_id = $1
          AND broker_name = 'ICICI'
          AND is_active = true
        `,
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
         3) FSM STATE LOAD
         ====================================================== */
      const fsmResult = await query(
        `
        SELECT state, attempts, locked_until
        FROM icici_login_attempts
        WHERE user_id = $1
        `,
        [userId]
      );

      const fsm = fsmResult.rows[0];

      if (fsm?.locked_until && new Date(fsm.locked_until) > new Date()) {
        return res.status(423).json({
          success: false,
          code: "ICICI_LOCKED",
          message: "ICICI login temporarily locked",
        });
      }

      /* ======================================================
         4) SESSION CONSISTENCY CHECK
         ====================================================== */
      const sessionService = SessionService.getInstance();
      const activeSession = await sessionService.getSession(userId);
      const hasActiveSession = !!activeSession?.session_token;

      if (fsm?.state === "SESSION_ACTIVE" && !hasActiveSession) {
        log("FSM desync detected — resetting state (user %s)", userId);
        await query(
          `
          UPDATE icici_login_attempts
          SET state = 'FAILED', updated_at = now()
          WHERE user_id = $1
          `,
          [userId]
        );
      }

      /* ======================================================
         5) MODE-SPECIFIC FSM ENFORCEMENT
         ====================================================== */

      /* ---------- LOGIN ---------- */
      if (mode === "LOGIN") {
        if (hasActiveSession || fsm?.state === "LOGIN_INITIATED") {
          return res.status(409).json({
            success: false,
            code: "ICICI_LOGIN_BLOCKED",
            message: "ICICI login already in progress or connected",
          });
        }

        const nextAttempts = (fsm?.attempts ?? 0) + 1;

        if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
          await query(
            `
            INSERT INTO icici_login_attempts (user_id, state, attempts, locked_until)
            VALUES ($1, 'LOCKED', $2, now() + interval '${LOCK_DURATION_MIN} minutes')
            ON CONFLICT (user_id)
            DO UPDATE SET
              state = 'LOCKED',
              attempts = EXCLUDED.attempts,
              locked_until = EXCLUDED.locked_until,
              updated_at = now()
            `,
            [userId, nextAttempts]
          );

          return res.status(423).json({
            success: false,
            code: "ICICI_LOCKED",
            message: "Too many login attempts. Temporarily locked.",
          });
        }

        await query(
          `
          INSERT INTO icici_login_attempts (user_id, state, attempts, last_attempt_at)
          VALUES ($1, 'LOGIN_INITIATED', 1, now())
          ON CONFLICT (user_id)
          DO UPDATE SET
            state = 'LOGIN_INITIATED',
            attempts = $2,
            last_attempt_at = now(),
            updated_at = now()
          `,
          [userId, nextAttempts]
        );
      }

      /* ---------- CALLBACK ---------- */
      if (mode === "CALLBACK") {
        if (fsm?.state !== "LOGIN_INITIATED") {
          return res.status(409).json({
            success: false,
            code: "ICICI_CALLBACK_INVALID",
            message: "ICICI callback without login initiation",
          });
        }
      }

      /* ---------- CONNECT ---------- */
      if (mode === "CONNECT") {
        if (hasActiveSession) {
          return res.json({
            success: true,
            connected: true,
            message: "ICICI already connected",
          });
        }
      }

      next();
    } catch (err: any) {
      log("ICICI guard failure for user %s: %s", userId, err.message);
      return res.status(500).json({
        success: false,
        error: "ICICI guard failure",
      });
    }
  };
