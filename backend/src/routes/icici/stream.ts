// backend/src/routes/icici/stream.ts
/**
 * ICICI Realtime Stream Router + WebSocket Upgrader
 *
 * Responsibilities:
 * - HTTP endpoints: /status, /subscribe, /unsubscribe
 * - WebSocket server: Upgrades HTTP → WebSocket, authenticates via JWT
 * - Forwards live market ticks (Breeze R50-compliant)
 * - Handles dynamic subscribe/unsubscribe per symbol
 *
 * Features:
 * - Cloudflare-friendly: Supports ?token= query for proxy compatibility
 * - Secure: JWT validation + SessionService integration
 * - Scalable: Leverages ICICIRealtimeService singleton
 * - Observable: Comprehensive debug logging
 *
 * Routes:
 * - GET /api/icici/stream/status → Check WS availability
 * - POST /api/icici/stream/subscribe → Subscribe to symbol
 * - POST /api/icici/stream/unsubscribe → Unsubscribe from symbol
 * - GET /api/icici/stream → Dummy endpoint for client discovery
 * - WS /api/icici/stream → WebSocket feed with ?token= or sec-websocket-protocol
 */

import { Router } from "express";
import { WebSocketServer, WebSocket, RawData } from "ws"; // Import RawData type
import jwt from "jsonwebtoken";
import debug from "debug";
import { IncomingMessage } from "http";
import { Socket } from "net";
import { iciciRealtimeService } from "../../services/iciciRealtime.js";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import type { MarketTick } from "../../types/marketTick.js";

const log = debug("apex:icici:stream");
const errorLog = debug("apex:icici:stream:error");

// Extend IncomingMessage for WebSocket authentication
interface WsRequest extends IncomingMessage {
  userId?: string;
}

// Express Router
export const iciciStreamRouter = Router();

/**
 * GET /api/icici/stream/status
 * Check if WebSocket feed is ready
 */
iciciStreamRouter.get("/status", authenticateToken, async (_req, res) => {
  try {
    res.json({
      success: true,
      connected: true,
      message: "ICICI WebSocket Feed Ready",
    });
  } catch (error: any) {
    errorLog("Status check failed:", error.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * POST /api/icici/stream/subscribe
 * Subscribe to a market symbol (e.g., RELIANCE|NSE)
 */
iciciStreamRouter.post("/subscribe", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { symbol, exchange = "NSE" } = req.body;

    if (!symbol) {
      return res.status(400).json({ success: false, error: "symbol required" });
    }

    await iciciRealtimeService.startUserStream(userId, (tick: MarketTick) => {
      log(`Tick for user ${userId}: ${tick.symbol} @ ${tick.ltp}`);
    });

    iciciRealtimeService.subscribe(userId, symbol, exchange);
    log(`User ${userId} subscribed to ${symbol} (${exchange})`);

    res.json({ success: true, subscribed: symbol });
  } catch (error: any) {
    errorLog(`Subscribe error for user ${req.user!.userId}:`, error.message);
    res.status(500).json({ success: false, error: error.message || "Failed to subscribe" });
  }
});

/**
 * POST /api/icici/stream/unsubscribe
 * Unsubscribe from a market symbol
 */
iciciStreamRouter.post("/unsubscribe", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { symbol, exchange = "NSE" } = req.body;

    if (!symbol) {
      return res.status(400).json({ success: false, error: "symbol required" });
    }

    iciciRealtimeService.unsubscribe(userId, symbol, exchange);
    log(`User ${userId} unsubscribed from ${symbol} (${exchange})`);

    res.json({ success: true, unsubscribed: symbol });
  } catch (error: any) {
    errorLog(`Unsubscribe error for user ${req.user!.userId}:`, error.message);
    res.status(500).json({ success: false, error: error.message || "Failed to unsubscribe" });
  }
});

/**
 * GET /api/icici/stream
 * Dummy endpoint for client discovery
 */
iciciStreamRouter.get("/", authenticateToken, (_req, res) => {
  try {
    res.json({
      success: true,
      ws: `WebSocket available at wss://${process.env.HOST || "api.alphaforge.skillsifter.in"}/api/icici/stream`,
    });
  } catch (error: any) {
    errorLog("Stream discovery failed:", error.message);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * WebSocket Server Implementation
 * Upgrades HTTP to WebSocket, authenticates, and relays ticks
 */
export function initIciciStreamServer(server: any): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req: WsRequest, socket: Socket, head: Buffer) => {
    if (!req.url?.startsWith("/api/icici/stream")) {
      socket.destroy();
      return;
    }

    try {
      let token: string | undefined;

      const proto = req.headers["sec-websocket-protocol"];
      if (proto) {
        token = Array.isArray(proto) ? proto[0] : proto;
      }

      if (!token && req.url) {
        const u = new URL(req.url, "https://api.alphaforge.skillsifter.in");
        token = u.searchParams.get("token") || undefined;
      }

      if (!token) {
        log("WS auth failed: No token provided");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const decoded = await authenticateWsToken(token);
      if (!decoded?.userId) {
        throw new Error("Invalid token");
      }
      req.userId = decoded.userId;

      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        wss.emit("connection", ws, req);
      });
    } catch (error: any) {
      errorLog("WS upgrade failed:", error.message);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", async (ws: WebSocket, req: WsRequest) => {
    const userId = req.userId!;
    log(`WebSocket connected for user ${userId}`);

    try {
      await iciciRealtimeService.startUserStream(userId, (tick: MarketTick) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "tick", data: tick }));
        }
      });

      ws.send(JSON.stringify({ type: "connected", userId }));

      ws.on("message", async (data: RawData) => {
        try {
          const message = JSON.parse(data.toString());
          const { action, symbol, exchange = "NSE" } = message;

          switch (action) {
            case "subscribe":
              if (!symbol) throw new Error("symbol required");
              iciciRealtimeService.subscribe(userId, symbol, exchange);
              ws.send(JSON.stringify({ type: "subscribed", symbol }));
              log(`User ${userId} subscribed to ${symbol} via WS`);
              break;

            case "unsubscribe":
              if (!symbol) throw new Error("symbol required");
              iciciRealtimeService.unsubscribe(userId, symbol, exchange);
              ws.send(JSON.stringify({ type: "unsubscribed", symbol }));
              log(`User ${userId} unsubscribed from ${symbol} via WS`);
              break;

            case "ping":
              ws.send(JSON.stringify({ type: "pong" }));
              break;

            default:
              throw new Error(`Unknown action: ${action}`);
          }
        } catch (error: any) {
          errorLog(`WS message error for user ${userId}:`, error.message);
          ws.send(JSON.stringify({ type: "error", error: error.message }));
        }
      });

      ws.on("close", async (code, reason) => {
        iciciRealtimeService.stopUserStream(userId);
        log(`WebSocket closed for user ${userId} | Code: ${code} | Reason: ${reason}`);
      });

      ws.on("error", async (error: Error) => {
        iciciRealtimeService.stopUserStream(userId);
        errorLog(`WebSocket error for user ${userId}:`, error.message);
      });
    } catch (error: any) {
      errorLog(`Failed to initialize stream for user ${userId}:`, error.message);
      ws.close(1011, error.message);
    }
  });

  return wss;
}

/**
 * Authenticate WebSocket JWT token
 */
async function authenticateWsToken(token: string): Promise<any> {
  try {
    return await new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET || "", (err, decoded) => {
        if (err) reject(new Error("Invalid token"));
        resolve(decoded);
      });
    });
  } catch (error: any) {
    errorLog("JWT verification failed:", error.message);
    throw error;
  }
}
