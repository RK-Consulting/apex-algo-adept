// backend/src/services/iciciRealtime.ts
/**
 * ICICI Realtime Service — Refactored for New Architecture
 *
 * Design:
 * - WebSocket streaming ONLY (no REST, no checksum)
 * - No Breeze SDK usage
 * - Stateless per-user stream management
 * - Session fetched via SessionService (Redis + DB)
 * - Clean reconnect, heartbeat, subscribe/unsubscribe
 */

import WebSocket from "ws";
import debug from "debug";
import { SessionService } from "./sessionService";

const log = debug("alphaforge:icici:realtime");
const errLog = debug("alphaforge:icici:realtime:error");

export interface TickData {
  symbol: string;
  ltp: number;
  timestamp?: string;
  [key: string]: any;
}

interface UserStream {
  userId: string;
  ws: WebSocket;
  symbols: Set<string>;
  heartbeat?: NodeJS.Timeout;
  reconnectAttempts: number;
}

export class ICICIRealtimeService {
  private static instance: ICICIRealtimeService;
  private streams = new Map<string, UserStream>();

  private readonly WS_URL = "wss://stream.icicidirect.com/breezeapi/realtime";
  private readonly HEARTBEAT_MS = 30_000;
  private readonly MAX_RETRIES = 10;
  private readonly BASE_DELAY = 1000;

  private constructor() {}

  static getInstance(): ICICIRealtimeService {
    if (!this.instance) {
      this.instance = new ICICIRealtimeService();
    }
    return this.instance;
  }

  async startUserStream(
    userId: string,
    onTick: (tick: TickData) => void
  ): Promise<void> {
    if (this.streams.has(userId)) return;

    const session = await SessionService.getInstance().getSessionOrThrow(userId);

    const ws = new WebSocket(this.WS_URL, {
      headers: {
        "X-AppKey": session.api_key,
        "X-SessionToken": session.session_token,
      },
    });

    const stream: UserStream = {
      userId,
      ws,
      symbols: new Set(),
      reconnectAttempts: 0,
    };

    ws.on("open", () => {
      log("WS open for user %s", userId);
      stream.reconnectAttempts = 0;
      this.startHeartbeat(stream);
    });

    ws.on("message", (data) => {
      try {
        const msg = data.toString();
        if (msg === "pong") return;

        const tick = JSON.parse(msg);
        if (tick?.symbol && typeof tick.ltp === "number") {
          onTick(tick);
        }
      } catch {
        errLog("Malformed WS message for user %s", userId);
      }
    });

    ws.on("close", () => {
      log("WS closed for user %s", userId);
      this.clearHeartbeat(stream);
      this.reconnect(userId, onTick);
    });

    ws.on("error", () => {
      errLog("WS error for user %s", userId);
    });

    this.streams.set(userId, stream);
  }

  subscribe(userId: string, symbol: string, exchange = "NSE"): void {
    const stream = this.streams.get(userId);
    if (!stream || stream.ws.readyState !== WebSocket.OPEN) return;
    if (stream.symbols.has(symbol)) return;

    stream.ws.send(
      JSON.stringify({
        action: "subscribe",
        symbol: `${exchange}|${symbol}`,
      })
    );

    stream.symbols.add(symbol);
  }

  unsubscribe(userId: string, symbol: string, exchange = "NSE"): void {
    const stream = this.streams.get(userId);
    if (!stream || stream.ws.readyState !== WebSocket.OPEN) return;
    if (!stream.symbols.has(symbol)) return;

    stream.ws.send(
      JSON.stringify({
        action: "unsubscribe",
        symbol: `${exchange}|${symbol}`,
      })
    );

    stream.symbols.delete(symbol);
  }

  stopUserStream(userId: string): void {
    const stream = this.streams.get(userId);
    if (!stream) return;

    this.clearHeartbeat(stream);
    stream.ws.close();
    this.streams.delete(userId);
  }

  stopAll(): void {
    for (const userId of this.streams.keys()) {
      this.stopUserStream(userId);
    }
  }

  private startHeartbeat(stream: UserStream): void {
    this.clearHeartbeat(stream);
    stream.heartbeat = setInterval(() => {
      if (stream.ws.readyState === WebSocket.OPEN) {
        stream.ws.ping();
      }
    }, this.HEARTBEAT_MS);
  }

  private clearHeartbeat(stream: UserStream): void {
    if (stream.heartbeat) {
      clearInterval(stream.heartbeat);
      stream.heartbeat = undefined;
    }
  }

  private reconnect(userId: string, onTick: (tick: TickData) => void): void {
    const stream = this.streams.get(userId);
    if (!stream) return;

    if (stream.reconnectAttempts >= this.MAX_RETRIES) {
      errLog("Max WS retries reached for user %s", userId);
      this.streams.delete(userId);
      return;
    }

    const delay = this.BASE_DELAY * 2 ** stream.reconnectAttempts;
    stream.reconnectAttempts++;

    setTimeout(() => {
      this.streams.delete(userId);
      this.startUserStream(userId, onTick).catch(() => {});
    }, delay);
  }
}

// singleton exports
export const iciciRealtimeService = ICICIRealtimeService.getInstance();
export const {
  startUserStream,
  stopUserStream,
  subscribe,
  unsubscribe,
  stopAll,
} = iciciRealtimeService;
