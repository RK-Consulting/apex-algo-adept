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

import debug from "debug";
import { getBreezeInstance } from "../utils/breezeSession.js";

const log = debug("alphaforge:icici:realtime");

export type MsgHandler = (tick: any) => void;

interface StreamHandle {
  breeze: any;
  subscribedSymbols: Set<string>;
  handler: MsgHandler;
  connected: boolean;
  connecting: boolean;
}

const streams = new Map<string, StreamHandle>();

/**
 * Start (or reuse) a realtime stream for a user
 */
export async function startUserStream(userId: string, handler: MsgHandler) {
  let existing = streams.get(userId);

  if (existing) {
    existing.handler = handler;
    if (!existing.connected && !existing.connecting) {
      safeConnect(existing);
    }
    return existing;
  }

  // Create NEW Breeze instance via authenticated session_token
  const breeze = await getBreezeInstance(userId);

  const stream: StreamHandle = {
    breeze,
    handler,
    subscribedSymbols: new Set(),
    connected: false,
    connecting: false,
  };

  streams.set(userId, stream);

  // ---- WEBSOCKET EVENT HANDLERS ----
  breeze.on("open", () => {
    log("WS opened for user %s", userId);
    stream.connected = true;
    stream.connecting = false;
  });

  breeze.on("close", () => {
    log("WS closed for user %s", userId);
    stream.connected = false;

    // Auto-reconnect after delay
    setTimeout(() => {
      if (!stream.connected && !stream.connecting) {
        log("Reconnecting WS for %s…", userId);
        safeConnect(stream);
      }
    }, 3000);
  });

  breeze.on("error", (err: any) => {
    log("WS error for %s: %O", userId, err);
  });

  breeze.on("message", (msg: any) => {
    try {
      if (!msg) return;

      const parsed =
        typeof msg === "string"
          ? JSON.parse(msg)
          : msg;

      // Sometimes ICICI sends heartbeats or empty objects
      if (!parsed || Object.keys(parsed).length === 0) return;

      stream.handler(parsed);
    } catch (err) {
      log("Tick parse error for %s: %O", userId, err);
    }
  });

  // Start the WS connection
  safeConnect(stream);

  return stream;
}

/**
 * Ensure safe connection (avoid double connect errors)
 */
function safeConnect(stream: StreamHandle) {
  if (stream.connected || stream.connecting) return;

  stream.connecting = true;

  try {
    stream.breeze.connect();
  } catch (err) {
    stream.connecting = false;
    log("Breeze connect error: %O", err);
  }
}

/**
 * Subscribe to a symbol feed for a user
 */
export async function subscribeSymbol(
  userId: string,
  symbol: string,
  exchange = "NSE"
) {
  const stream = streams.get(userId);
  if (!stream) throw new Error("Stream not started for user");

  if (stream.subscribedSymbols.has(symbol)) return;

  stream.subscribedSymbols.add(symbol);

  try {
    stream.breeze.subscribeFeeds({
      stockCode: String(symbol),
      exchangeCode: String(exchange),
      productType: "cash",
    });

    log("Subscribed user %s -> %s", userId, symbol);
  } catch (err) {
    log("Subscribe error for %s: %O", userId, err);
  }
}

/**
 * Unsubscribe a symbol feed
 */
export async function unsubscribeSymbol(
  userId: string,
  symbol: string,
  exchange = "NSE"
) {
  const stream = streams.get(userId);
  if (!stream) return;

  if (!stream.subscribedSymbols.has(symbol)) return;

  stream.subscribedSymbols.delete(symbol);

  try {
    stream.breeze.unsubscribeFeeds({
      stockCode: String(symbol),
      exchangeCode: String(exchange),
      productType: "cash",
    });

    log("Unsubscribed user %s -> %s", userId, symbol);
  } catch (err) {
    log("Unsubscribe error for %s: %O", userId, err);
  }
}

/**
 * Stop one user's realtime stream
 */
export function stopUserStream(userId: string) {
  const stream = streams.get(userId);
  if (!stream) return;

  try {
    stream.breeze.disconnect();
  } catch (err) {
    log("Disconnect error for %s: %O", userId, err);
  }

  streams.delete(userId);

  log("Stopped stream for %s", userId);
}

/**
 * Stop ALL realtime streams (server shutdown)
 */
export function stopAllRealtimeStreams() {
  for (const userId of streams.keys()) {
    stopUserStream(userId);
  }

  streams.clear();
  log("Stopped ALL ICICI realtime streams.");
}
