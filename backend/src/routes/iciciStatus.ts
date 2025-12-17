// apex-algo-adept/backend/src/routes/iciciStatus.ts
/**
 * ICICI STATUS ROUTER — Refactored for New Architecture
 *
 * Provides:
 * - Whether ICICI credentials exist
 * - Whether a valid Breeze session is active (server-side only)
 *
 * Notes:
 * - No JWT/session token is ever exposed
 * - Status derived purely from SessionService + credentials table
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { SessionService } from "../services/sessionService.js";

export const iciciStatusRouter = Router();

/**
 * GET /api/icici/status
 */
iciciStatusRouter.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Check if ICICI credentials exist
    const credResult = await query(
      `
      SELECT 1
      FROM icici_credentials
      WHERE user_id = $1
      `,
      [userId]
    );

    const hasCredentials = credResult.rowCount > 0;

    // Check active Breeze session (server-side only)
    const session = await SessionService.getInstance().getSession(userId);
    const connected = !!session?.session_token;

    return res.json({
      success: true,
      connected,
      hasCredentials,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch ICICI status",
    });
  }
});
