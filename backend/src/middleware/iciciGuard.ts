// backend/src/middleware/iciciGuard.ts

/**
 * ICICI Guard Middleware
 *
 * Enforces ICICI connection state machine
 * Prevents OAuth / callback bombardment
 *
 * Guards:
 * - /api/icici/auth/login
 * - /api/icici/auth/callback
 * - /api/icici/broker/connect
 *
 * Single Source of Truth:
 * - broker_credentials table
 * - icici_sessions table (via SessionService)
 */

import { Response, NextFunction } from "express";
import debug from "debug";
import { AuthRequest } from "./auth.js";
import { query } from "../config/database.js";
import { SessionService } from "../services/sessionService.js";

const log = debug("alphaforge:icici:guard");

export type IciciGuardMode = "LOGIN" | "CALLBACK" | "CONNECT";

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

      if ((profileResult.rowCount ?? 0) === 0) {
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

      if ((credResult.rowCount ?? 0) === 0) {
        return res.status(400).json({
          success: false,
          code: "ICICI_CREDENTIALS_MISSING",
          message: "ICICI API credentials not configured",
        });
      }

      /* ======================================================
         3) FSM STATE CHECK (icici_login_attempts)
         ====================================================== */
      const fsmResult = await query(
        `
        SELECT state, locked_until
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
        log("FSM desync detected — resetting ICICI state for user %s", userId);
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
         5) MODE-SPECIFIC ENFORCEMENT
         ====================================================== */

      if (mode === "LOGIN") {
        if (hasActiveSession || fsm?.state === "LOGIN_INITIATED") {
          return res.status(409).json({
            success: false,
            code: "ICICI_LOGIN_BLOCKED",
            message: "ICICI login already in progress or connected",
          });
        }
      }

      if (mode === "CALLBACK") {
        if (fsm?.state !== "LOGIN_INITIATED") {
          return res.status(409).json({
            success: false,
            code: "ICICI_CALLBACK_INVALID",
            message: "ICICI callback without login initiation",
          });
        }
      }

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
