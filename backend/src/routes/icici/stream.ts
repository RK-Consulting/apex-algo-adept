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
 *        - Authenticate using:
 *              1) sec-websocket-protocol
 *              2) URL query ?token=
 *    • Forward live ticks
 *    • Handle dynamic subscribe / unsubscribe
 *
 *  Cloudflare Friendly:
 *    - Cloudflare strips WebSocket headers sometimes
 *    - Therefore URL ?token= is required
 * ************************************************************
 */

import { Router } from "express";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import debug from "debug";
import { IncomingMessage } from "http";
import { Socket } from "net";

import {
  startUserStream,
  stopUserStream,
  subscribeSymbol,
  unsubscribeSymbol,
} from "../../services/iciciRealtime.js";

import { authenticateToken, AuthRequest } from "../../middleware/auth.js";

const log = debug("apex:icici:stream");

/* --------------------------------------------------------------
   EXPORT EXPRESS ROUTER
-------------------------------------------------------------- */
export const iciciStreamRouter = Router();

/* --------------------------------------------------------------
   Extend IncomingMessage with userId for WS authentication
-------------------------------------------------------------- */
interface WsRequest extends IncomingMessage {
  userId?: string;
}

/* --------------------------------------------------------------
   GET /api/icici/stream/status
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
-------------------------------------------------------------- */
iciciStreamRouter.post(
  "/subscribe",
  authenticateToken,
  async (req: AuthRequest, res) => {
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
  }
);

/* --------------------------------------------------------------
   POST /api/icici/stream/unsubscribe
-------------------------------------------------------------- */
iciciStreamRouter.post(
  "/unsubscribe",
  authenticateToken,
  async (req: AuthRequest, res) => {
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
  }
);

/* --------------------------------------------------------------
   GET /api/icici/stream
   Dummy endpoint
-------------------------------------------------------------- */
iciciStreamRouter.get("/", authenticateToken, (_req, res) => {
  return res.json({
    success: true,
    ws: "WebSocket available at wss://host/api/icici/stream",
  });
});

/* ***************************************************************
   WEBSOCKET SERVER IMPLEMENTATION
*************************************************************** */
export function initIciciStreamServer(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  /* ------------------------------------------------------------
     Handle HTTP → WS upgrade
  ------------------------------------------------------------ */
  server.on(
    "upgrade",
    async (req: WsRequest, socket: Socket, head: Buffer) => {
      if (!req.url?.startsWith("/api/icici/stream")) return;

      try {
        let token: string | undefined;

        // ======================================================
        // MODE 1: Header → sec-websocket-protocol
        // ======================================================
        const proto = req.headers["sec-websocket-protocol"];
        if (proto) {
          token = Array.isArray(proto) ? proto[0] : proto;
        }

        // ======================================================
        // MODE 2: URL query string → ?token=xyz
        // Required for Cloudflare workers / CF proxy
        // ======================================================
        if (!token && req.url) {
          try {
            const u = new URL(req.url, "https://dummy-origin");
            const qp = u.searchParams.get("token");
            if (qp) token = qp;
          } catch {
            /* ignore invalid urls */
          }
        }

        // Missing token
        if (!token) {
          log("WS auth failed: No token provided");
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          return socket.destroy();
        }

        // Validate token
        const decoded: any = await authenticateWsToken(token);
        if (!decoded?.userId) throw new Error("Invalid token");

        req.userId = decoded.userId;
      } catch (err) {
        log("WS auth failed:", err);
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        return socket.destroy();
      }

      // Allow the WS connection
      // wss.handleUpgrade(req, socket, head, (ws) => {
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        wss.emit("connection", ws, req);
      });
    }
  );

  /* ------------------------------------------------------------
     When WS is connected
  ------------------------------------------------------------ */
  wss.on("connection", async (ws: WebSocket, req: WsRequest) => {
    const userId = req.userId!;
    log("WS User connected:", userId);

    // Start streaming
    await startUserStream(userId, (tick) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "tick", ...tick }));
      }
    });

    ws.send(JSON.stringify({ type: "connected", userId }));

    /* ----------------------------------------------------------
       WS Incoming Messages
    ---------------------------------------------------------- */
    ws.on("message", async (msg: string | Buffer) => {
      try {
        const data = JSON.parse(msg.toString());

        switch (data.action) {
          case "subscribe":
            await subscribeSymbol(userId, data.symbol, data.exchange || "NSE");
            ws.send(
              JSON.stringify({ type: "subscribed", symbol: data.symbol })
            );
            break;

          case "unsubscribe":
            await unsubscribeSymbol(
              userId,
              data.symbol,
              data.exchange || "NSE"
            );
            ws.send(
              JSON.stringify({ type: "unsubscribed", symbol: data.symbol })
            );
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
       CLOSE / ERROR
    ---------------------------------------------------------- */
    ws.on("close", () => {
      stopUserStream(userId);
      log("WS closed:", userId);
    });

    //ws.on("error", (err) => {
    ws.on("error", (err: Error) => {
      stopUserStream(userId);
      log("WS error:", err);
    });
  });

  return wss;
}

/* ***************************************************************
   JWT VALIDATION
*************************************************************** */
function authenticateWsToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

