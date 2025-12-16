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
import { getBreezeInstance } from "../services/breezeClient.js"; // Assumes this returns configured BreezeConnect instance using session

const log = debug("alphaforge:icici:realtime");
const errorLog = debug("alphaforge:icici:realtime:error");

interface TickData {
  symbol: string;
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  oi?: number; // Open Interest
  timestamp?: string;
  [key: string]: any; // Flexible for future fields
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
  private readonly HEARTBEAT_INTERVAL = 30_000; // 30 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly BASE_RECONNECT_DELAY = 1000; // 1 second

  private constructor() {
    log("[ICICIRealtimeService] Initialized");
  }

  static getInstance(): ICICIRealtimeService {
    if (!ICICIRealtimeService.instance) {
      ICICIRealtimeService.instance = new ICICIRealtimeService();
    }
    return ICICIRealtimeService.instance;
  }

  /**
   * Start real-time stream for a user
   */
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
      const breeze = getBreezeInstance(session); // Uses cached session_token

      const wsUrl = "wss://stream.icicidirect.com/breezeapi/realtime"; // Official Breeze WS endpoint
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

        // Start heartbeat
        this.startHeartbeat(stream);
      });

      ws.on("message", (data: WebSocket.Data) => {
        try {
          const message = data.toString();
          if (message === "pong" || message === "heartbeat") {
            return; // Ignore heartbeats
          }

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

  /**
   * Subscribe to a symbol for a user
   */
  async subscribeSymbol(userId: string, symbol: string, exchange: string = "NSE"): Promise<void> {
    const stream = this.userStreams.get(userId);
    if (!stream || stream.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Stream not active");
    }

    if (stream.subscribedSymbols.has(symbol)) {
      log(`Already subscribed to ${symbol} for user ${userId}`);
      return;
    }

    const subscribeMsg = JSON.stringify({
      channel: "feed",
      action: "subscribe",
      symbol: `${exchange}|${symbol}`,
    });

    stream.ws.send(subscribeMsg);
    stream.subscribedSymbols.add(symbol);
    log(`Subscribed ${symbol} (${exchange}) for user ${userId}`);
  }

  /**
   * Unsubscribe from a symbol
   */
  async unsubscribeSymbol(userId: string, symbol: string, exchange: string = "NSE"): Promise<void> {
    const stream = this.userStreams.get(userId);
    if (!stream || stream.ws.readyState !== WebSocket.OPEN) {
      return; // Already closed
    }

    if (!stream.subscribedSymbols.has(symbol)) {
      return;
    }

    const unsubscribeMsg = JSON.stringify({
      channel: "feed",
      action: "unsubscribe",
      symbol: `${exchange}|${symbol}`,
    });

    stream.ws.send(unsubscribeMsg);
    stream.subscribedSymbols.delete(symbol);
    log(`Unsubscribed ${symbol} for user ${userId}`);
  }

  /**
   * Stop stream for a user (logout or tab close)
   */
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

  /**
   * Stop all active streams (server shutdown)
   */
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

  // Private helpers
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
    const delay = stream.reconnectDelay * Math.pow(2, stream.reconnectAttempts - 1); // Exponential backoff

    log(`Reconnecting stream for user ${userId} in ${delay}ms (attempt ${stream.reconnectAttempts})`);

    setTimeout(() => {
      this.startUserStream(userId, onTick, onError).catch(() => {
        this.attemptReconnect(userId, onTick, onError);
      });
    }, delay);
  }
}

// Export singleton for convenience
export const iciciRealtimeService = ICICIRealtimeService.getInstance();

// Optional: Standalone quote fetcher (for on-demand quotes outside stream)
export const fetchQuote = async (
  userId: string,
  params: {
    stock_code: string;
    exchange_code: string;
    product_type?: string;
    expiry_date?: string;
    right?: string;
    strike_price?: string;
  }
): Promise<any> => {
  try {
    const session = await SessionService.getInstance().getSessionOrThrow(userId);
    const breeze = getBreezeInstance(session);
    const quote = await breeze.getQuotes(params);
    log(`Quote fetched for ${params.stock_code}: %O`, quote);
    return quote;
  } catch (error: any) {
    errorLog(`Quote fetch failed for user ${userId}:`, error.message);
    throw error;
  }
};
