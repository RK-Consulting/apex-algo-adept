// backend/src/routes/icici/streamUpgrade.ts
/**
 * WebSocket upgrade handler.
 *
 * Call initIciciWsUpgrade(server) from server.ts AFTER creating the http server.
 * It uses the 'ws' library to upgrade to a WebSocket and authenticates using the
 * subprotocol header or sec-websocket-protocol containing the JWT.
 *
 * The handler wires into services/iciciRealtime.startUserStream(...)
 * and forwards Breeze ticks down to the ws client.
 */

import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import debug from "debug";
import { startUserStream, stopUserStream } from "../../services/iciciRealtime.js";

const log = debug("apex:icici:stream:upgrade");

export function initIciciWsUpgrade(server: any /* http.Server */) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request: any, socket: any, head: any) => {
    if (!request.url?.startsWith("/api/icici/stream/live")) return;

    // Extract token from subprotocol or query param
    const tokenHeader = request.headers["sec-websocket-protocol"] || request.headers["authorization"];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // token may be "auth,<jwt>" when passed as subprotocol by browser — handle both.
    const rawToken = (token as string).includes(",") ? (token as string).split(",")[1] : (token as string).replace("Bearer ", "");

    try {
      const decoded: any = jwt.verify(rawToken, process.env.JWT_SECRET!);
      request.userId = decoded.userId;
    } catch (err) {
      log("WS auth failed:", err);
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", async (ws: any, req: any) => {
    const userId = req.userId;
    log("WS connection for user %s", userId);

    const stream = await startUserStream(userId, (tick) => {
      if (ws.readyState === ws.OPEN) {
        try { ws.send(JSON.stringify({ type: "tick", data: tick })); } catch {}
      }
    });

    ws.send(JSON.stringify({ type: "connected", message: "ICICI live feed connected" }));

    ws.on("message", async (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.action) {
          case "subscribe":
            await stream.breeze.subscribeFeeds({ stockCode: msg.symbol, exchangeCode: msg.exchange || "NSE", productType: "cash" });
            ws.send(JSON.stringify({ type: "subscribed", symbol: msg.symbol }));
            break;
          case "unsubscribe":
            await stream.breeze.unsubscribeFeeds({ stockCode: msg.symbol, exchangeCode: msg.exchange || "NSE", productType: "cash" });
            ws.send(JSON.stringify({ type: "unsubscribed", symbol: msg.symbol }));
            break;
          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          default:
            log("Unknown ws message:", msg);
        }
      } catch (err) {
        log("WS message parse error:", err);
      }
    });

    ws.on("close", () => {
      stopUserStream(userId);
      log("Client WS closed for %s", userId);
    });

    ws.on("error", (err: any) => {
      stopUserStream(userId);
      log("WS error for %s: %O", userId, err);
    });
  });

  return wss;
}
