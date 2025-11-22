// backend/services/iciciRealtime.ts
/**
 * ************************************************************
 *  ICICI Realtime Relay / Stream service
 *  -----------------------------------------------------------
 *  - Manages per-user BreezeConnect WS sessions
 *  - Subscribes/unsubscribes tickers on user's Breeze session
 *  - Exposes start/stop/subscribe/unsubscribe helpers
 * ************************************************************
 */

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

export async function startUserStream(userId: string, handler: MsgHandler) {
  let existing = streams.get(userId);
  if (existing) {
    existing.handler = handler;
    if (!existing.connected && !existing.connecting) {
      safeConnect(existing);
    }
    return existing;
  }

  const breeze = await getBreezeInstance(userId);

  const stream: StreamHandle = {
    breeze,
    handler,
    subscribedSymbols: new Set(),
    connected: false,
    connecting: false,
  };

  streams.set(userId, stream);

  breeze.on("open", () => {
    log("Breeze WS opened for %s", userId);
    stream.connected = true;
    stream.connecting = false;
  });

  breeze.on("close", () => {
    log("Breeze WS closed for %s", userId);
    stream.connected = false;
    setTimeout(() => {
      if (!stream.connected && !stream.connecting) safeConnect(stream);
    }, 3000);
  });

  breeze.on("error", (err: any) => {
    log("Breeze WS error for %s: %O", userId, err);
  });

  breeze.on("message", (msg: any) => {
    try {
      const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
      stream.handler(parsed);
    } catch (e) {
      log("Tick parse error for %s: %O", userId, e);
    }
  });

  safeConnect(stream);
  return stream;
}

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

export async function subscribeSymbol(userId: string, symbol: string, exchange = "NSE") {
  const stream = streams.get(userId);
  if (!stream) throw new Error("Stream not started for user");
  if (stream.subscribedSymbols.has(symbol)) return;
  stream.subscribedSymbols.add(symbol);
  try {
    stream.breeze.subscribeFeeds({ stockCode: String(symbol), exchangeCode: String(exchange), productType: "cash" });
    log("Subscribed %s -> %s", userId, symbol);
  } catch (err) {
    log("Subscribe error: %O", err);
  }
}

export async function unsubscribeSymbol(userId: string, symbol: string, exchange = "NSE") {
  const stream = streams.get(userId);
  if (!stream) return;
  if (!stream.subscribedSymbols.has(symbol)) return;
  stream.subscribedSymbols.delete(symbol);
  try {
    stream.breeze.unsubscribeFeeds({ stockCode: String(symbol), exchangeCode: String(exchange), productType: "cash" });
    log("Unsubscribed %s -> %s", userId, symbol);
  } catch (err) {
    log("Unsubscribe error: %O", err);
  }
}

export function stopUserStream(userId: string) {
  const s = streams.get(userId);
  if (!s) return;
  try {
    s.breeze.disconnect();
  } catch (err) {
    log("Disconnect error: %O", err);
  }
  streams.delete(userId);
  log("Stopped stream for %s", userId);
}

export function stopAllRealtimeStreams() {
  for (const u of Array.from(streams.keys())) {
    stopUserStream(u);
  }
  streams.clear();
  log("Stopped all realtime streams");
}
