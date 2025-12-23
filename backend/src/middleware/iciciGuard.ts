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

export type IciciGuardMode =
  | "LOGIN"
  | "CALLBACK"
  | "CONNECT";

export const iciciGuard =
  (mode: IciciGuardMode) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthenticated",
        });
      }

      /* ======================================================
         1) CHECK ICICI CREDENTIALS EXIST & ACTIVE
         ====================================================== */
      const credResult = await query(
        `
        SELECT id, is_active
        FROM broker_credentials
        WHERE user_id = $1
          AND broker_name = 'ICICI'
          AND is_active = true
        `,
        [userId]
      );

      if ((credResult.rowCount ?? 0) === 0) {
        log("User %s has no active ICICI credentials", userId);
        return res.status(400).json({
          success: false,
          code: "ICICI_CREDENTIALS_MISSING",
          message: "ICICI API credentials not configured",
        });
      }

      /* ======================================================
         2) CHECK EXISTING ICICI SESSION
         ====================================================== */
      const sessionService = SessionService.getInstance();
      const activeSession = await sessionService.getSession(userId);

      const hasActiveSession = !!activeSession?.session_token;

      /* ======================================================
         3) MODE-SPECIFIC RULES
         ====================================================== */

      // ---- LOGIN ENTRYPOINT ----
      if (mode === "LOGIN") {
        if (hasActiveSession) {
          log("Blocked ICICI login — already connected (user %s)", userId);
          return res.status(409).json({
            success: false,
            code: "ICICI_ALREADY_CONNECTED",
            message: "ICICI already connected",
          });
        }
      }

      // ---- CALLBACK HANDLER ----
      if (mode === "CALLBACK") {
        if (hasActiveSession) {
          log("Blocked ICICI callback replay (user %s)", userId);
          return res.status(409).json({
            success: false,
            code: "ICICI_CALLBACK_REPLAY",
            message: "ICICI session already established",
          });
        }
      }

      // ---- BROKER CONNECT (HINT ONLY) ----
      if (mode === "CONNECT") {
        if (hasActiveSession) {
          return res.json({
            success: true,
            connected: true,
            message: "ICICI already connected",
          });
        }
      }

      /* ======================================================
         4) PASS CONTROL
         ====================================================== */
      next();
    } catch (err: any) {
      log("ICICI guard failure for user %s: %s", req.user?.userId, err.message);
      return res.status(500).json({
        success: false,
        error: "ICICI guard failure",
      });
    }
  };
