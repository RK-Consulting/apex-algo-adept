// backend/src/routes/iciciStreamControlRouter.ts
/**
 * Stream control HTTP endpoints (subscribe/unsubscribe) for frontend to call.
 *
 * Mount path: app.use('/api/icici/stream', iciciStreamControlRouter);
 *
 * Endpoints:
 * POST /subscribe { symbol, exchange }
 * POST /unsubscribe { symbol, exchange }
 * GET / simple JSON to confirm route presence
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import * as Realtime from "../services/iciciRealtime.js"; // Namespace import to bypass missing named exports
import debug from "debug";

const router = Router();
const log = debug("apex:icici:stream:control");

router.get("/", authenticateToken, (_req: AuthRequest, res) => {
  res.json({ success: true, message: "ICICI stream control ready" });
});

router.post("/subscribe", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { symbol, exchange = "NSE" } = req.body;

    if (!symbol) return res.status(400).json({ error: "symbol required" });

    // Ensure a breeze stream exists for user (start if needed)
    await Realtime.startUserStream(userId, () => {});
    await Realtime.subscribeSymbol(userId, symbol, exchange);

    res.json({ success: true, subscribed: symbol });
  } catch (err) {
    next(err);
  }
});

router.post("/unsubscribe", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { symbol, exchange = "NSE" } = req.body;

    if (!symbol) return res.status(400).json({ error: "symbol required" });

    await Realtime.unsubscribeSymbol(userId, symbol, exchange);

    res.json({ success: true, unsubscribed: symbol });
  } catch (err) {
    next(err);
  }
});

export { router as iciciStreamControlRouter };
