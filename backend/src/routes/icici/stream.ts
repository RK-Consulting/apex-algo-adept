// backend/src/routes/icici/stream.ts
import { Router } from "express";
import { WebSocketServer } from "ws";
import { authenticateToken } from "../../middleware/auth.js";
import {
  startUserStream,
  stopUserStream,
  subscribeSymbol,
  unsubscribeSymbol,
} from "../../services/iciciRealtime.js";
import debug from "debug";

const log = debug("apex:icici:stream");

// ---------------------------------------------
// WebSocket Router Mount (HTTP → WS Upgrade)
// ---------------------------------------------

const router = Router();

/**
 * This GET route only exists to allow Cloudflare / Nginx / Browser
 * to hit the endpoint. Actual WS upgrade happens in server.ts
 */
router.get("/stream", authenticateToken, (req, res) => {
  return res.json({
    success: true,
    message: "WebSocket available at ws://host/api/icici/stream",
  });
});

export { router as iciciStreamRouter };

/**
 * This function must be called from server.ts after HTTP server is created:
 *
 *    import { initIciciStreamServer } from "./routes/icici/stream.js";
 *    const wss = initIciciStreamServer(server);
 */
export function initIciciStreamServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade request from Express server
  server.on("upgrade", async (request, socket, head) => {
    if (!request.url?.startsWith("/api/icici/stream")) return;

    // We manually run JWT validation here because this is WS, not HTTP.
    try {
      const tokenHeader = request.headers["sec-websocket-protocol"];

      if (!tokenHeader) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

      const decoded = await authenticateWsToken(token);
      request.userId = decoded.userId;
    } catch (err) {
      log("WS Auth failed:", err);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // Main WebSocket connection handler
  wss.on("connection", async (ws, req) => {
    const userId = req.userId;
    log("WS: User connected:", userId);

    // Attach Breeze realtime stream
    const stream = await startUserStream(userId, (tick) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "tick", data: tick }));
      }
    });

    ws.send(JSON.stringify({ type: "connected", message: "ICICI live feed connected" }));

    // Handle incoming messages from frontend
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

          default:
            log("Unknown WS action:", data);
        }
      } catch (err) {
        log("WS message error:", err);
      }
    });

    ws.on("close", () => {
      log("WS: User disconnected:", userId);
      stopUserStream(userId);
    });

    ws.on("error", (err) => {
      log("WS Error:", err);
      stopUserStream(userId);
    });
  });

  return wss;
}

/**
 * JWT validator for WebSocket protocol header
 * This reuses your normal middleware logic.
 */
import jwt from "jsonwebtoken";

async function authenticateWsToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}
