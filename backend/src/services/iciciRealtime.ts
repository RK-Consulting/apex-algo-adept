// backend/src/services/iciciRealtime.ts
/**
 * ICICI Realtime Service - High-Performance Market Data Streaming
 *
 * Features:
 * - One isolated Breeze WebSocket per authenticated user
 * - Auto-reconnect with exponential backoff
 * - Per-symbol subscribe/unsubscribe
 * - Heartbeat monitoring and malformed message handling
 * - Graceful shutdown support
 * - Integrates with SessionService (Redis-cached sessions)
 *
 * Production-ready for AlphaForge's live trading dashboard
 */

import WebSocket from "ws";
import debug from "debug";
import { SessionService } from "./sessionService.js";
import { getBreezeInstance } from "./breezeClient.js"; // Correct factory

const log = debug("alphaforge:icici:realtime");
const errorLog = debug("alphaforge:icici:realtime:error");

export interface TickData {
  symbol: string;
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  oi?: number;
  timestamp?: string;
  [key: string]: any;
}

interface UserStream {
  ws: WebSocket;
  userId: string;
  subscribedSymbols: Set<string>;
  heartbeatTimer?: NodeJS.Timeout;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
}

export class ICICIRealtimeService {
  private static instance: ICICIRealtimeService;
  private userStreams: Map<string, UserStream> = new Map();
  private readonly sessionService = SessionService.getInstance();
  private readonly HEARTBEAT_INTERVAL = 30_000;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 1000;

  private constructor() {
    log("[ICICIRealtimeService] Initialized");
  }

  static getInstance(): ICICIRealtimeService {
    if (!ICICIRealtimeService.instance) {
      ICICIRealtimeService.instance = new ICICIRealtimeService();
    }
    return ICICIRealtimeService.instance;
  }

  async startUserStream(
    userId: string,
    onTick: (tick: TickData) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (this.userStreams.has(userId)) {
      log(`Stream already active for user ${userId}`);
      return;
    }

    try {
      const session = await this.sessionService.getSessionOrThrow(userId);
      const breeze = getBreezeInstance(session);
      const wsUrl = "wss://stream.icicidirect.com/breezeapi/realtime";
      const ws = new WebSocket(wsUrl);

      const stream: UserStream = {
        ws,
        userId,
        subscribedSymbols: new Set(),
        reconnectAttempts: 0,
        maxReconnectAttempts: this.MAX_RECONNECT_ATTEMPTS,
        reconnectDelay: this.BASE_RECONNECT_DELAY,
      };

      ws.on("open", () => {
        log(`WebSocket opened for user ${userId}`);
        stream.reconnectAttempts = 0;
        stream.reconnectDelay = this.BASE_RECONNECT_DELAY;
        this.startHeartbeat(stream);
      });

      ws.on("message", (data: WebSocket.Data) => {
        try {
          const message = data.toString();
          if (message === "pong" || message === "heartbeat") return;

          const tick: TickData = JSON.parse(message);
          if (tick.symbol && typeof tick.ltp === "number") {
            onTick(tick);
          } else {
            errorLog(`Malformed tick from user ${userId}:`, tick);
          }
        } catch (parseError) {
          errorLog(`Failed to parse message for user ${userId}:`, data);
        }
      });

      ws.on("close", (code, reason) => {
        log(`WebSocket closed for user ${userId} | Code: ${code} | Reason: ${reason}`);
        this.clearHeartbeat(stream);
        this.attemptReconnect(userId, onTick, onError);
      });

      ws.on("error", (err) => {
        errorLog(`WebSocket error for user ${userId}:`, err.message);
        onError?.(err);
      });

      this.userStreams.set(userId, stream);
    } catch (error: any) {
      errorLog(`Failed to start stream for user ${userId}:`, error.message);
      throw error;
    }
  }

  async subscribeSymbol(userId: string, symbol: string, exchange: string = "NSE"): Promise<void> {
    const stream = this.userStreams.get(userId);
    if (!stream || stream.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Stream not active");
    }
    if (stream.subscribedSymbols.has(symbol)) {
      log(`Already subscribed to ${symbol} for user ${userId}`);
      return;
    }
    const msg = JSON.stringify({
      channel: "feed",
      action: "subscribe",
      symbol: `${exchange}|${symbol}`,
    });
    stream.ws.send(msg);
    stream.subscribedSymbols.add(symbol);
    log(`Subscribed ${symbol} (${exchange}) for user ${userId}`);
  }

  async unsubscribeSymbol(userId: string, symbol: string, exchange: string = "NSE"): Promise<void> {
    const stream = this.userStreams.get(userId);
    if (!stream || stream.ws.readyState !== WebSocket.OPEN) return;
    if (!stream.subscribedSymbols.has(symbol)) return;
    const msg = JSON.stringify({
      channel: "feed",
      action: "unsubscribe",
      symbol: `${exchange}|${symbol}`,
    });
    stream.ws.send(msg);
    stream.subscribedSymbols.delete(symbol);
    log(`Unsubscribed ${symbol} for user ${userId}`);
  }

  async stopUserStream(userId: string): Promise<void> {
    const stream = this.userStreams.get(userId);
    if (!stream) return;
    this.clearHeartbeat(stream);
    if (stream.ws.readyState === WebSocket.OPEN) {
      stream.ws.close(1000, "User logout");
    }
    this.userStreams.delete(userId);
    log(`Stream stopped for user ${userId}`);
  }

  async stopAllRealtimeStreams(): Promise<void> {
    log("Stopping all ICICI realtime streams...");
    for (const [userId, stream] of this.userStreams.entries()) {
      this.clearHeartbeat(stream);
      if (stream.ws.readyState === WebSocket.OPEN) {
        stream.ws.close(1012, "Server shutdown");
      }
    }
    this.userStreams.clear();
    log("All realtime streams terminated");
  }

  private startHeartbeat(stream: UserStream): void {
    this.clearHeartbeat(stream);
    stream.heartbeatTimer = setInterval(() => {
      if (stream.ws.readyState === WebSocket.OPEN) {
        stream.ws.ping();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private clearHeartbeat(stream: UserStream): void {
    if (stream.heartbeatTimer) {
      clearInterval(stream.heartbeatTimer);
      stream.heartbeatTimer = undefined;
    }
  }

  private async attemptReconnect(
    userId: string,
    onTick: (tick: TickData) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    const stream = this.userStreams.get(userId);
    if (!stream || stream.reconnectAttempts >= stream.maxReconnectAttempts) {
      this.userStreams.delete(userId);
      errorLog(`Max reconnect attempts reached for user ${userId}`);
      return;
    }
    stream.reconnectAttempts++;
    const delay = stream.reconnectDelay * Math.pow(2, stream.reconnectAttempts - 1);
    log(`Reconnecting stream for user ${userId} in ${delay}ms (attempt ${stream.reconnectAttempts})`);
    setTimeout(() => {
      this.startUserStream(userId, onTick, onError).catch(() => {
        this.attemptReconnect(userId, onTick, onError);
      });
    }, delay);
  }
}

// === EXPORTS (single, non-duplicated) ===
export const {
  startUserStream,
  stopUserStream,
  subscribeSymbol,
  unsubscribeSymbol,
  stopAllRealtimeStreams,
} = ICICIRealtimeService.getInstance();

export type { TickData };

export const iciciRealtimeService = ICICIRealtimeService.getInstance();
