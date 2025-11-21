// backend/src/routes/icici/streamControlRouter.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import {
  startUserStream,
  stopUserStream,
  subscribeSymbol,
  unsubscribeSymbol,
} from "../../services/iciciRealtime.js";

const router = Router();

/**
 * POST /api/icici/stream/start
 * Ensure realtime WS session is prepared on backend
 */
router.post("/start", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    await startUserStream(userId, () => {});

    return res.json({
      success: true,
      message: "Realtime stream started",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to start realtime stream",
    });
  }
});

/**
 * POST /api/icici/stream/stop
 */
router.post("/stop", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    stopUserStream(userId);

    return res.json({
      success: true,
      message: "Realtime stream stopped",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to stop realtime stream",
    });
  }
});

/**
 * POST /api/icici/stream/subscribe
 */
router.post("/subscribe", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { symbol, exchange = "NSE" } = req.body;

    if (!symbol)
      return res.status(400).json({ error: "symbol required" });

    await startUserStream(userId, () => {});
    await subscribeSymbol(userId, symbol, exchange);

    return res.json({
      success: true,
      subscribed: symbol,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Subscription failed",
    });
  }
});

/**
 * POST /api/icici/stream/unsubscribe
 */
router.post("/unsubscribe", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { symbol, exchange = "NSE" } = req.body;

    if (!symbol)
      return res.status(400).json({ error: "symbol required" });

    await unsubscribeSymbol(userId, symbol, exchange);

    return res.json({
      success: true,
      unsubscribed: symbol,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Unsubscribe failed",
    });
  }
});

export { router as iciciStreamControlRouter };
