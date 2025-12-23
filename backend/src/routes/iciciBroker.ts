// /backend/src/routes/iciciBroker.ts

/**
 * ICICI Broker Routes — Aligned with System Architecture
 *
 * Responsibilities:
 * - ICICI-specific broker checks
 * - Connection readiness validation
 *
 * Explicitly DOES NOT:
 * - Store credentials
 * - Encrypt / decrypt secrets
 * - Handle sessions or apisession
 *
 * Single Source of Truth:
 * - broker_credentials table
 * - /api/credentials routes
 */

import { Router } from "express";
import debug from "debug";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { iciciGuard } from "../middleware/iciciGuard.js";
import { query } from "../config/database.js";

const router = Router();
const log = debug("alphaforge:icici:broker");

/* ======================================================
   1) CHECK ICICI CONNECTION STATUS
   ====================================================== */
router.get(
  "/status",
  authenticateToken,
  async (req: AuthRequest, res) => {
    const serverUserId = req.user!.userId;
    const serverBrokerName = "ICICI";

    const dbResult = await query(
      `
      SELECT is_active, last_connected, created_at
      FROM broker_credentials
      WHERE user_id = $1
        AND broker_name = $2
      `,
      [serverUserId, serverBrokerName]
    );

    if ((dbResult.rowCount ?? 0) === 0) {
      return res.json({
        connected: false,
        broker: serverBrokerName,
      });
    }

    return res.json({
      connected: true,
      broker: serverBrokerName,
      ...dbResult.rows[0],
    });
  }
);

/* ======================================================
   2) CONNECT ENTRYPOINT (GUARDED)
   ====================================================== */
router.post(
  "/connect",
  authenticateToken,
  iciciGuard({
    requireProfileComplete: true,
    requireCredentials: true,
    disallowIfSessionActive: true,
  }),
  async (_req: AuthRequest, res) => {
    /**
     * Frontend flow:
     * 1. Ensure credentials saved via /api/credentials/store
     * 2. Call /api/icici/auth/login
     */
    log("ICICI connect preconditions satisfied");

    return res.json({
      success: true,
      message: "Proceed to ICICI OAuth via /api/icici/auth/login",
    });
  }
);

export { router as iciciBrokerRouter };
export default router;
