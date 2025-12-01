// apex-algo-adept/backend/src/routes/iciciStatus.ts
/**
 * ************************************************************
 *  ICICI STATUS ROUTER
 *  -----------------------------------------------------------
 *  Provides:
 *    • Current ICICI connection status (Connected / Not Connected)
 *    • Whether JWT token exists for the user
 *    • Basic session metadata (expiry)
 *    • Whether encrypted credentials exist
 *
 *  Routes:
 *    GET /api/icici/status
 * ************************************************************
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { getSessionForUser } from "../utils/breezeSession.js";

export const iciciStatusRouter = Router();

/**
 * GET /api/icici/status
 * (Notice: route is "/" because app.ts already sets /api/icici/status)
 */
iciciStatusRouter.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `SELECT icici_credentials
       FROM user_credentials
       WHERE user_id = $1 AND broker_name = 'icici'`,
      [userId]
    );

    const hasCredentials =
      result.rows.length > 0 && result.rows[0].icici_credentials !== null;

    const session = await getSessionForUser(userId);
    const isConnected = !!session?.jwtToken;

    return res.json({
      success: true,
      connected: isConnected,
      hasCredentials,
      session: session
        ? {
            tokenPresent: true,
            expiresAt: session.expires_at || null,
          }
        : {
            tokenPresent: false,
          },
    });
  } catch (err: any) {
    console.error("ICICI Status Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch ICICI status",
    });
  }
});
