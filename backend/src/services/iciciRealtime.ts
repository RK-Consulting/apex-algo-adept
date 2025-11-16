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
}

const streams = new Map<string, StreamHandle>();

/**
 * Start realtime stream for a user
 */
export async function startUserStream(
  userId: string,
  handler: MsgHandler
) {
  if (streams.has(userId)) {
    log("Stream already active for user %s", userId);
    return streams.get(userId);
  }

  log("Starting realtime stream for user %s", userId);

  const breeze = await getBreezeInstance(userId);

  const stream: StreamHandle = {
    breeze,
    handler,
    subscribedSymbols: new Set(),
    connected: false,
  };
  streams.set(userId, stream);

  // Attach event listeners BEFORE connect()
  breeze.on("open", () => {
    log("WS opened for user %s", userId);
    stream.connected = true;
  });

  breeze.on("close", () => {
    log("WS closed for user %s", userId);
    stream.connected = false;
  });

  breeze.on("error", (err: any) => {
    log("WS error for %s: %O", userId, err);
  });

  breeze.on("message", (msg: any) => {
    try {
      handler(msg); // deliver ticks to consumer
    } catch (e) {
      log("Tick handler error for %s: %O", userId, e);
    }
  });

  // Now open websocket
  breeze.connect();

  return stream;
}

/**
 * Subscribe a user to a specific symbol
 */
export async function subscribeSymbol(
  userId: string,
  symbol: string,
  exchangeCode: string = "NSE"
) {
  const stream = streams.get(userId);
  if (!stream) throw new Error("Realtime stream not started");

  if (stream.subscribedSymbols.has(symbol)) return;

  stream.subscribedSymbols.add(symbol);

  stream.breeze.subscribeFeeds({
    stockCode: symbol,
    exchangeCode,
    productType: "cash",
  });

  log("User %s subscribed to %s", userId, symbol);
}

/**
 * Unsubscribe symbol
 */
export async function unsubscribeSymbol(
  userId: string,
  symbol: string,
  exchangeCode: string = "NSE"
) {
  const stream = streams.get(userId);
  if (!stream) return;

  if (!stream.subscribedSymbols.has(symbol)) return;

  stream.subscribedSymbols.delete(symbol);

  stream.breeze.unsubscribeFeeds({
    stockCode: symbol,
    exchangeCode,
    productType: "cash",
  });

  log("User %s unsubscribed from %s", userId, symbol);
}

/**
 * Stop real-time streaming for a user
 */
export function stopUserStream(userId: string) {
  const stream = streams.get(userId);
  if (!stream) return;

  try {
    stream.breeze.disconnect();
  } catch (e) {
    log("Error closing WS for %s: %O", userId, e);
  }

  streams.delete(userId);
  log("Stopped realtime stream for user %s", userId);
}
