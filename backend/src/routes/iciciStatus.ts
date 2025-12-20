// apex-algo-adept/backend/src/routes/iciciStatus.ts
/**
 * ICICI STATUS ROUTER — System-Engineering–Correct
 *
 * Provides:
 * - Whether ICICI broker credentials exist (DB-level)
 * - Whether an active Breeze session exists (server/runtime)
 *
 * Guarantees:
 * - No secrets exposed
 * - No session tokens exposed
 * - broker_credentials is the SINGLE source of truth
 *
 * Naming Discipline:
 * - DB layer     → app_key / app_secret
 * - Server layer → server*
 * - Runtime      → SessionService only
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
    /* ------------------------------
       SERVER CONTEXT
    ------------------------------ */
    const serverUserId = req.user!.userId;
    const serverBrokerName = "ICICI";

    /* ------------------------------
       DB: CHECK CREDENTIAL PRESENCE
       (NO SECRETS, NO DECRYPTION)
    ------------------------------ */
    const dbCredResult = await query(
      `
      SELECT 1
      FROM broker_credentials
      WHERE user_id = $1
        AND broker_name = $2
        AND is_active = true
      `,
      [serverUserId, serverBrokerName]
    );

    const hasCredentials = (dbCredResult.rowCount ?? 0) > 0;

    /* ------------------------------
       RUNTIME: CHECK ACTIVE SESSION
       (SERVER-SIDE ONLY)
    ------------------------------ */
    const runtimeSession =
      await SessionService.getInstance().getSession(serverUserId);

    const connected = !!runtimeSession?.session_token;

    /* ------------------------------
       RESPONSE (STATUS ONLY)
    ------------------------------ */
    return res.json({
      success: true,
      hasCredentials,
      connected,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch ICICI status",
    });
  }
});
