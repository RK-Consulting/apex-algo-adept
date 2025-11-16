// backend/services/iciciRealtime.ts
import WebSocket from "ws";
import debug from "debug";
import { getBreezeInstance } from "../utils/breezeSession.js";

const log = debug("apex:icici:realtime");

// Simple manager — supports opening a websocket for a user's breeze session.
// It is not a full pub/sub solution; you can call `startUserStream(userId, onMessage)` from routes or controllers.
type MsgHandler = (data: any) => void;

interface StreamHandle {
  ws?: WebSocket;
  reconnectAttempts: number;
  handler: MsgHandler;
}

const handles = new Map<string, StreamHandle>();

export async function startUserStream(userId: string, handler: MsgHandler) {
  if (handles.has(userId)) {
    log("Stream already active for %s", userId);
    return handles.get(userId);
  }

  // create a handle with reconnect logic
  const handle: StreamHandle = { reconnectAttempts: 0, handler };
  handles.set(userId, handle);

  const connect = async () => {
    try {
      const breeze = await getBreezeInstance(userId);
      // Breeze Connect may expose the socket URL or manage websocket internally.
      // If you need to use Breeeze's internal realtime helper, call it here.
      // Otherwise, connect to the wss endpoint with the session token:
      const sessionToken = (breeze as any).sessionToken || (breeze as any).getSessionToken?.();
      if (!sessionToken) throw new Error("Missing session token for realtime");

      const wsUrl = `wss://api.icicidirect.com/some/realtime/path?session_token=${sessionToken}`; // replace with exact Breeze URL if available
      const ws = new WebSocket(wsUrl);

      handle.ws = ws;
      handle.reconnectAttempts = 0;

      ws.on("open", () => log("WS opened for user %s", userId));
      ws.on("message", (msg) => {
        try {
          const data = JSON.parse(String(msg));
          handler(data);
        } catch (e) {
          log("WS parse error: %O", e);
        }
      });

      ws.on("close", (code, reason) => {
        log("WS closed for %s code=%d reason=%s", userId, code, String(reason));
        // try reconnect
        scheduleReconnect();
      });

      ws.on("error", (err) => {
        log("WS error for %s: %O", userId, err);
        // close and reconnect
        try { ws.terminate(); } catch (e) {}
      });

      function scheduleReconnect() {
        handle.reconnectAttempts++;
        const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(6, handle.reconnectAttempts)));
        log("Scheduling reconnect for %s in %dms", userId, delay);
        setTimeout(connect, delay);
      }
    } catch (err) {
      log("Failed to start stream for %s: %O", userId, err);
      // schedule reconnect attempt
      handle.reconnectAttempts++;
      const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(6, handle.reconnectAttempts)));
      setTimeout(connect, delay);
    }
  };

  // initial connect
  connect();

  return handle;
}

export function stopUserStream(userId: string) {
  const handle = handles.get(userId);
  if (!handle) return;
  try {
    handle.ws?.close();
  } catch (e) {}
  handles.delete(userId);
  log("Stopped stream for %s", userId);
}
