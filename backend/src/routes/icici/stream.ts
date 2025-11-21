// backend/src/routes/icici/stream.ts

import { Router } from "express";
import { WebSocketServer } from "ws";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import debug from "debug";
import jwt from "jsonwebtoken";

import {
  startUserStream,
  stopUserStream,
  subscribeSymbol,
  unsubscribeSymbol,
} from "../../services/iciciRealtime.js";

const log = debug("apex:icici:stream");

const router = Router();

/* ------------------------------------------------------------------
   REST ENDPOINTS (Subscribe/Unsubscribe/Status)
   These are required by:
   - Watchlist Pro Component
   - Markets page
-------------------------------------------------------------------*/

/**
 * GET /api/icici/stream/status
 */
router.get("/status", authenticateToken, async (req: AuthRequest, res) => {
  try {
    return res.json({
      success: true,
      connected: true,
      message: "ICICI WebSocket Feed Ready",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      connected: false,
      error: err.message || "Stream status error",
    });
  }
});

/**
 * POST /api/icici/stream/subscribe
 * Body: { symbol, exchange? }
 */
router.post("/subscribe", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { symbol, exchange = "NSE" } = req.body;

    if (!symbol) return res.status(400).json({ error: "symbol required" });

    await startUserStream(userId, () => {});
    await subscribeSymbol(userId, symbol, exchange);

    return res.json({ success: true, subscribed: symbol });
  } catch (err: any) {
    log("subscribe error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/icici/stream/unsubscribe
 */
router.post("/unsubscribe", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { symbol, exchange = "NSE" } = req.body;

    if (!symbol) return res.status(400).json({ error: "symbol required" });

    await unsubscribeSymbol(userId, symbol, exchange);

    return res.json({ success: true, unsubscribed: symbol });
  } catch (err: any) {
    log("unsubscribe error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET (dummy)
 * Allows browser/Nginx to confirm WS endpoint exists.
 */
router.get("/", authenticateToken, (req, res) => {
  return res.json({
    success: true,
    ws: "WebSocket available at wss://host/api/icici/stream",
  });
});

export { router as iciciStreamRouter };

/* ------------------------------------------------------------------
   REAL WEBSOCKET UPGRADE IMPLEMENTATION
   Called from server.ts → initIciciStreamServer(server)
-------------------------------------------------------------------*/

export function initIciciStreamServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    if (!req.url?.startsWith("/api/icici/stream")) return;

    try {
      const tokenHeader = req.headers["sec-websocket-protocol"];
      if (!tokenHeader) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        return socket.destroy();
      }

      const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
      const decoded = await authenticateWsToken(token);

      req.userId = decoded.userId;
    } catch (err) {
      log("WS auth failed:", err);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return socket.destroy();
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (ws, req) => {
    const userId = req.userId;
    log("WS User connected:", userId);

    const stream = await startUserStream(userId, (tick) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "tick", ...tick }));
      }
    });

    ws.send(JSON.stringify({ type: "connected", userId }));

    ws.on("message", async (msg) => {
      try {
        const data = JSON.parse(msg.toString());

        switch (data.action) {
          case "subscribe":
            await subscribeSymbol(userId, data.symbol, data.exchange || "NSE");
            ws.send(JSON.stringify({ type: "subscribed", symbol: data.symbol }));
            break;

          case "unsubscribe":
            await unsubscribeSymbol(userId, data.symbol, data.exchange || "NSE");
            ws.send(JSON.stringify({ type: "unsubscribed", symbol: data.symbol }));
            break;

          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;
        }
      } catch (err) {
        log("WS message error:", err);
      }
    });

    ws.on("close", () => {
      stopUserStream(userId);
      log("WS closed:", userId);
    });

    ws.on("error", (err) => {
      log("WS error:", err);
      stopUserStream(userId);
    });
  });

  return wss;
}

/**
 * JWT validator for WS protocol header
 */
function authenticateWsToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}
