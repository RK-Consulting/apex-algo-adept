// backend/src/middleware/checkIciciSession.ts
/**
 * ICICI Session Guard Middleware
 *
 * Responsibility:
 * - Verifies that a valid (non-expired) ICICI session exists
 * - DOES NOT access credentials
 * - DOES NOT decrypt secrets
 *
 * Data source:
 * - icici_sessions table ONLY
 */

import { Request, Response, NextFunction } from "express";
import { query } from "../config/database.js";
import debug from "debug";

const log = debug("alphaforge:icici:session");

/* ======================================================
   CONFIG
====================================================== */
const ICICI_SESSION_TTL_HOURS = 24;

export async function checkIciciSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    /* ------------------------------
       AUTH CONTEXT
    ------------------------------ */
    const authUser = (req as any).user;
    if (!authUser?.userId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const serverUserId = authUser.userId;

    /* ------------------------------
       SESSION LOOKUP
    ------------------------------ */
    const dbResult = await query(
      `
      SELECT
        session_token,
        created_at
      FROM icici_sessions
      WHERE idirect_userid = $1
      `,
      [serverUserId]
    );

    if ((dbResult.rowCount ?? 0) === 0) {
      log("❌ No ICICI session for user %s", serverUserId);
      return res.status(403).json({
        error: "ICICI_SESSION_MISSING",
        message: "ICICI Direct account is not connected.",
      });
    }

    /* ------------------------------
       EXPIRY CHECK
    ------------------------------ */
    const sessionCreatedAt: Date = dbResult.rows[0].created_at;
    const expiryTime =
      sessionCreatedAt.getTime() +
      ICICI_SESSION_TTL_HOURS * 60 * 60 * 1000;

    if (Date.now() >= expiryTime) {
      log("⛔ ICICI session expired for user %s", serverUserId);

      return res.status(440).json({
        error: "ICICI_SESSION_EXPIRED",
        message: "Your ICICI Direct session has expired. Please reconnect.",
      });
    }

    /* ------------------------------
       SESSION VALID
    ------------------------------ */
    return next();
  } catch (err) {
    console.error("checkIciciSession fatal error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
}
