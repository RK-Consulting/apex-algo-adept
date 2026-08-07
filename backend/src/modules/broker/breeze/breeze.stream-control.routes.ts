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

// backend/src/routes/iciciStreamControlRouter.ts
/**
 * ICICI Stream Control Router — Institutional-Grade Control Plane
 *
 * Responsibilities:
 * - HTTP control plane for WebSocket streams
 * - Start stream lazily per user
 * - Subscribe / unsubscribe symbols
 * - FSM-Gatekeeping (prevents streaming without active session)
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../../shared/middleware/auth.js";
import { iciciRealtimeService } from "./breeze.realtime.js";
import { IciciSessionFSM } from "./breeze.session-fsm.js";
import debug from "debug";

const router = Router();
const log = debug("alphaforge:icici:stream:control");

/* ======================================================
   CORS (Institutional Standard for Cross-Origin Strategy)
====================================================== */
router.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    process.env.FRONTEND_ORIGIN || "https://alphaforge.skillsifter.in"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/**
 * Health check
 */
router.get("/", authenticateToken, (_req: AuthRequest, res) => {
  res.json({ success: true, message: "ICICI stream control ready" });
});

/**
 * POST /subscribe
 * Body: { symbol, exchange? }
 * Aligns with Objective 2: Realtime Aggregator Data
 */
router.post("/subscribe", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { symbol, exchange = "NSE" } = req.body;

  if (!symbol) {
    return res.status(400).json({ error: "symbol required" });
  }

  try {
    // 1. FSM GUARD: Ensure broker is actually connected
    await IciciSessionFSM.requireActive(userId);

    // 2. LAZY START: Ensure user-specific WS exists
    // The callback here is the "Sink" for your live market data
    await iciciRealtimeService.startUserStream(userId, (_tick) => {
      /* SYSTEM NOTE: 
         In Objective 1 (Connector), this data triggers your AI Strategy.
         In Objective 2 (Aggregator), this data is broadcast to the UI.
      */
      // Example: global.io.to(userId).emit('tick', tick);
    });

    // 3. REGISTER SYMBOL
    iciciRealtimeService.subscribe(userId, symbol, exchange);

    log("✅ Subscribed %s (%s) for user %s", symbol, exchange, userId);

    res.json({
      success: true,
      subscribed: { symbol, exchange },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log("❌ Stream start failed for %s: %s", userId, message);
    res.status(412).json({ 
        error: "Broker session inactive. Please reconnect ICICI.",
        code: "ICICI_SESSION_REQUIRED" 
    });
  }
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

  try {
    iciciRealtimeService.unsubscribe(userId, symbol, exchange);

    log("🚫 Unsubscribed %s (%s) for user %s", symbol, exchange, userId);

    res.json({
      success: true,
      unsubscribed: { symbol, exchange },
    });
  } catch {
    res.status(500).json({ error: "Unsubscribe failed" });
  }
});

export { router as iciciStreamControlRouter };
