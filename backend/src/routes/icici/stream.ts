// backend/src/routes/icici/stream.ts

/**
 * ************************************************************
 *  ICICI REALTIME STREAM ROUTER + WEBSOCKET UPGRADER
 *  -----------------------------------------------------------
 *  Responsibilities:
 *    • HTTP endpoints:
 *        - /api/icici/stream/status
 *        - /api/icici/stream/subscribe
 *        - /api/icici/stream/unsubscribe
 *    • WebSocket server:
 *        - Upgrade HTTP → WebSocket
 *        - Authenticate using JWT
 *        - Forward live ticks
 *        - Handle dynamic subscribe/unsubscribe
 *
 *  Dependencies:
 *    - iciciRealtime.ts (startUserStream, subscribeSymbol, etc.)
 *    - JWT authentication
 *
 *  Notes:
 *    - Fully TypeScript-safe (strict mode)
 *    - Extends IncomingMessage with userId field
 * ************************************************************
 */

import { Router } from "express";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import debug from "debug";
import { IncomingMessage } from "http";

import {
  startUserStream,
  stopUserStream,
  subscribeSymbol,
  unsubscribeSymbol,
} from "../../services/iciciRealtime.js";

import { authenticateToken, AuthRequest } from "../../middleware/auth.js";

const log = debug("apex:icici:stream");
export const iciciStreamRouter = Router();

/* --------------------------------------------------------------
   Extend IncomingMessage with userId for WS authentication
-------------------------------------------------------------- */
interface WsRequest extends IncomingMessage {
  userId?: string;
}

/* --------------------------------------------------------------
   GET /api/icici/stream/status
   Simple health-check for WebSocket layer
-------------------------------------------------------------- */
iciciStreamRouter.get("/status", authenticateToken, async (_req, res) => {
  return res.json({
    success: true,
    connected: true,
    message: "ICICI WebSocket Feed Ready",
  });
});

/* --------------------------------------------------------------
   POST /api/icici/stream/subscribe
   Subscribe user to a symbol before WS
-------------------------------------------------------------- */
iciciStreamRouter.post("/subscribe", authenticateToken, async (req: AuthRequest, res) => {
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

/* --------------------------------------------------------------
   POST /api/icici/stream/unsubscribe
-------------------------------------------------------------- */
iciciStreamRouter.post("/unsubscribe", authenticateToken, async (req: AuthRequest, res) => {
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

/* --------------------------------------------------------------
   GET /api/icici/stream
   Dummy endpoint for browsers
-------------------------------------------------------------- */
iciciStreamRouter.get("/", authenticateToken, (req, res) => {
  return res.json({
    success: true,
    ws: "WebSocket available at wss://host/api/icici/stream",
  });
});

/* ==============================================================
   REAL WEBSOCKET UPGRADE IMPLEMENTATION
   Called from server.ts → initIciciStreamServer(server)
============================================================== */

export function initIciciStreamServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  /* ------------------------------------------------------------
     Handle WS Upgrade
  ------------------------------------------------------------ */
  server.on("upgrade", async (req: WsRequest, socket, head) => {
    if (!req.url?.startsWith("/api/icici/stream")) return;

    try {
      const tokenHeader = req.headers["sec-websocket-protocol"];
      if (!tokenHeader) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        return socket.destroy();
      }

      const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

      const decoded = await authenticateWsToken(token);
      if (!decoded?.userId) throw new Error("Invalid token");

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

  /* ------------------------------------------------------------
     WebSocket Connection Handler
  ------------------------------------------------------------ */
  wss.on("connection", async (ws: WebSocket, req: WsRequest) => {
    const userId = req.userId!;
    log("WS User connected:", userId);

    // Start realtime feed
    const stream = await startUserStream(userId, (tick) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "tick", ...tick }));
      }
    });

    ws.send(JSON.stringify({ type: "connected", userId }));

    /* ----------------------------------------------------------
       Incoming WS Messages
    ---------------------------------------------------------- */
    ws.on("message", async (msg: string | Buffer) => {
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

    /* ----------------------------------------------------------
       Close + Error Cleanup
    ---------------------------------------------------------- */
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

/* ==============================================================
   JWT Validator for WS protocol header
============================================================== */
function authenticateWsToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}
