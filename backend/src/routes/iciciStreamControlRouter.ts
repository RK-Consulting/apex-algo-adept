// backend/src/routes/iciciStreamControlRouter.ts
/**
 * ICICI Stream Control Router — Refactored for New Realtime Architecture
 *
 * Responsibilities:
 * - HTTP control plane for WebSocket streams
 * - Start stream lazily per user
 * - Subscribe / unsubscribe symbols
 *
 * Notes:
 * - JWT protected
 * - No Breeze SDK usage
 * - Delegates all logic to ICICIRealtimeService
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { iciciRealtimeService } from "../../services/iciciRealtime.js";
import debug from "debug";

const router = Router();
const log = debug("alphaforge:icici:stream:control");

/**
 * Health check
 */
router.get("/", authenticateToken, (_req: AuthRequest, res) => {
  res.json({ success: true, message: "ICICI stream control ready" });
});

/**
 * POST /subscribe
 * Body: { symbol, exchange? }
 */
router.post("/subscribe", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { symbol, exchange = "NSE" } = req.body;

  if (!symbol) {
    return res.status(400).json({ error: "symbol required" });
  }

  // Lazily ensure stream exists
  await iciciRealtimeService.startUserStream(userId, () => {});

  subscribe(userId, symbol, exchange);

  log("Subscribed %s (%s) for user %s", symbol, exchange, userId);

  res.json({
    success: true,
    subscribed: { symbol, exchange },
  });
});

/**
 * POST /unsubscribe
 * Body: { symbol, exchange? }
 */
router.post("/unsubscribe", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { symbol, exchange = "NSE" } = req.body;

  if (!symbol) {
    return res.status(400).json({ error: "symbol required" });
  }

  iciciRealtimeService.unsubscribe(userId, symbol, exchange);

  log("Unsubscribed %s (%s) for user %s", symbol, exchange, userId);

  res.json({
    success: true,
    unsubscribed: { symbol, exchange },
  });
});

export { router as iciciStreamControlRouter };
