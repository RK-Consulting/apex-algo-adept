// backend/services/iciciRealtime.ts
/**
 * ************************************************************
 *  ICICI Realtime Relay / Stream service (Final Production Version)
 *  ---------------------------------------------------------------
 *  - One WebSocket session per user (isolated)
 *  - Auto reconnect with safety guard
 *  - Subscribe / Unsubscribe per symbol
 *  - Uses Breeze R50-compliant getBreezeInstance()
 *  - Handles JSON ticks, heartbeats, malformed payloads
 * ************************************************************
 */

// (Current is fine, but for scale, consider Redis pub/sub for WS messages across instances)
import { getBreezeInstance } from "../utils/breezeSession.js";
import debug from "debug";

const log = debug("apex:icici:realtime");

// ... (rest same as current, but use getBreezeInstance for breeze)

// In safeConnect:
async function safeConnect(stream: StreamHandle) {
  if (stream.connected || stream.connecting) return;

  stream.connecting = true;

  try {
    stream.breeze = await getBreezeInstance(stream.userId); // Ensure fresh
    stream.breeze.connect();
  } catch (err) {
    stream.connecting = false;
    log("Connect error for %s: %O", stream.userId, err);
  }
}
