// backend/src/middleware/iciciGuard.ts

import { Request, Response, NextFunction } from "express";
import debug from "debug";
import { IciciSessionFSM } from "../services/iciciSessionFSM.js";
import { AuthRequest } from "./auth.js";

const log = debug("alphaforge:icici:guard");

/**
 * ICICI Guard Middleware
 *
 * Enforces:
 * - FSM state validation
 * - No retry storms
 * - No direct ICICI access without valid session
 *
 * This middleware MUST wrap every ICICI route
 */
export function iciciGuard(options?: {
  requireActiveSession?: boolean;
  allowWhenExpired?: boolean;
}) {
  const requireActiveSession = options?.requireActiveSession ?? true;
  const allowWhenExpired = options?.allowWhenExpired ?? false;

  return async function (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "AUTH_REQUIRED",
        });
      }

      const state = await IciciSessionFSM.getState(userId);
      log(`ICICI Guard: user=${userId}, state=${state}`);

      // Hard stop: LOCKED
      if (state === "LOCKED") {
        return res.status(429).json({
          error: "ICICI temporarily locked due to multiple failures",
          code: "ICICI_LOCKED",
        });
      }

      // Require active session
      if (requireActiveSession && state !== "SESSION_ACTIVE") {
        // Allow specific expired flows if configured
        if (state === "SESSION_EXPIRED" && allowWhenExpired) {
          return next();
        }

        return res.status(409).json({
          error: "ICICI session not active",
          state,
          code: "ICICI_SESSION_INVALID",
        });
      }

      // Everything ok
      return next();
    } catch (err: any) {
      log("❌ ICICI Guard error", err);

      return res.status(500).json({
        error: "ICICI guard failure",
        message: err.message,
        code: "ICICI_GUARD_ERROR",
      });
    }
  };
}
