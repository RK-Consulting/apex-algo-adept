// backend/services/iciciRealtime.ts
import debug from "debug";
import { getBreezeInstance } from "../utils/breezeSession.js";

const log = debug("apex:icici:realtime");

export type MsgHandler = (tick: any) => void;

interface StreamHandle {
  breeze: any;
  subscribedSymbols: Set<string>;
  handler: MsgHandler;
  connected: boolean;
  connecting: boolean;
}

const streams = new Map<string, StreamHandle>();

// ------------------------------------------------------------
// 1. Start WebSocket realtime session per user
// ------------------------------------------------------------
export async function startUserStream(userId: string, handler: MsgHandler) {
  let existing = streams.get(userId);

  if (existing) {
    log("Stream already active for user %s", userId);
    existing.handler = handler; // update handler
    return existing;
  }

  log("Starting realtime stream for user %s", userId);

  const breeze = await getBreezeInstance(userId);

  const stream: StreamHandle = {
    breeze,
    handler,
    subscribedSymbols: new Set(),
    connected: false,
    connecting: false,
  };

  streams.set(userId, stream);

  // ------------------------------------------------------------
  // Event listeners before connect()
  // ------------------------------------------------------------
  breeze.on("open", () => {
    log("WS opened for user %s", userId);
    stream.connected = true;
    stream.connecting = false;
  });

  breeze.on("close", () => {
    log("WS closed for user %s", userId);
    stream.connected = false;

    // Auto-reconnect safety (optional but recommended)
    setTimeout(() => {
      if (!stream.connected && !stream.connecting) {
        log("Reconnecting WS for user %s", userId);
        safeConnect(stream);
      }
    }, 3000);
  });

  breeze.on("error", (err: any) => {
    log("WS error for user %s: %O", userId, err);
  });

  breeze.on("message", (msg: any) => {
    try {
      // Normalize message format
      const parsed =
        typeof msg === "string"
          ? JSON.parse(msg)
          : msg?.data || msg;

      stream.handler(parsed);
    } catch (err) {
      log("Tick handler error for %s: %O", userId, err);
    }
  });

  // ------------------------------------------------------------
  // Begin WebSocket connection
  // ------------------------------------------------------------
  safeConnect(stream);

  return stream;
}

// Safe connect wrapper to avoid multiple simultaneous connect() calls
function safeConnect(stream: StreamHandle) {
  if (stream.connected || stream.connecting) return;

  stream.connecting = true;

  try {
    stream.breeze.connect();
  } catch (err) {
    stream.connecting = false;
    log("Error during WS connect(): %O", err);
  }
}

// ------------------------------------------------------------
// 2. Subscribe to ticker
// ------------------------------------------------------------
export async function subscribeSymbol(
  userId: string,
  symbol: string,
  exchangeCode = "NSE"
) {
  const stream = streams.get(userId);
  if (!stream) throw new Error("Realtime stream not started");

  if (stream.subscribedSymbols.has(symbol)) return;

  stream.subscribedSymbols.add(symbol);

  try {
    stream.breeze.subscribeFeeds({
      stockCode: String(symbol),
      exchangeCode: String(exchangeCode),
      productType: "cash",
    });

    log("User %s subscribed to %s", userId, symbol);
  } catch (err) {
    log("Subscribe error for %s: %O", userId, err);
  }
}

// ------------------------------------------------------------
// 3. Unsubscribe
// ------------------------------------------------------------
export async function unsubscribeSymbol(
  userId: string,
  symbol: string,
  exchangeCode = "NSE"
) {
  const stream = streams.get(userId);
  if (!stream) return;

  if (!stream.subscribedSymbols.has(symbol)) return;

  stream.subscribedSymbols.delete(symbol);

  try {
    stream.breeze.unsubscribeFeeds({
      stockCode: String(symbol),
      exchangeCode: String(exchangeCode),
      productType: "cash",
    });

    log("User %s unsubscribed from %s", userId, symbol);
  } catch (err) {
    log("Unsubscribe error for %s: %O", userId, err);
  }
}

// ------------------------------------------------------------
// 4. Stop a single user WS
// ------------------------------------------------------------
export function stopUserStream(userId: string) {
  const stream = streams.get(userId);
  if (!stream) return;

  log("Stopping realtime stream for user %s", userId);

  try {
    stream.breeze.disconnect();
  } catch (err) {
    log("WS disconnect error for %s: %O", userId, err);
  }

  streams.delete(userId);
}

// ------------------------------------------------------------
// 5. Stop all user streams (needed by server.ts shutdown)
// ------------------------------------------------------------
export function stopAllRealtimeStreams() {
  log("Stopping ALL realtime ICICI streams…");

  for (const userId of streams.keys()) {
    stopUserStream(userId);
  }

  streams.clear();
}
