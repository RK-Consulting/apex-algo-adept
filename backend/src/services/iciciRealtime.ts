// backend/src/services/iciciRealtime.ts

/* ... imports remain the same ... */

  /* ======================================================
      START USER STREAM
  ====================================================== */
  async startUserStream(
    userId: string,
    onTick: (tick: MarketTick) => void
  ): Promise<void> {
    if (this.streams.has(userId)) return;

    /* ------------------------------
        RUNTIME SESSION (EXPLICIT)
        Refined: Now pulls from our institutional session service
    ------------------------------ */
    const runtimeSession =
      await SessionService.getInstance().getSessionOrThrow(userId);

    const runtimeAppKey = runtimeSession.api_key;
    const runtimeSessionToken = runtimeSession.session_token;

    /* ------------------------------
        WEBSOCKET INIT
        Note: ICICI Breeze WS usually requires query params for auth 
        rather than headers, but your header contract is preserved.
    ------------------------------ */
    const ws = new WebSocket(this.WS_URL, {
      headers: {
        "X-App-Key": runtimeAppKey,
        "X-SessionToken": runtimeSessionToken,
      },
    });

    const stream: UserStream = {
      userId,
      ws,
      symbols: new Set(),
      reconnectAttempts: 0,
    };

    /* ------------------------------
        WS EVENTS
    ------------------------------ */
    ws.on("open", () => {
      log("Realtime WS open for user %s", userId);
      stream.reconnectAttempts = 0;
      
      // ICICI Breeze Handshake: Subscribe to basic symbols if needed
      // Most ICICI streams require an authentication JSON message immediately
      ws.send(JSON.stringify({
        action: "authenticate",
        app_key: runtimeAppKey,
        session_token: runtimeSessionToken
      }));
      
      this.startHeartbeat(stream);
    });

    /* ... ws.on message remains the same ... */

    ws.on("close", (code, reason) => {
      log("Realtime WS closed for user %s (Code: %d)", userId, code);
      this.clearHeartbeat(stream);
      
      // SURGICAL FIX: Only reconnect if the session hasn't been intentionally invalidated
      SessionService.getInstance().hasActiveSession(userId).then(active => {
        if (active) {
            this.reconnect(userId, onTick);
        } else {
            log("Session invalidated for user %s, skipping reconnect", userId);
            this.streams.delete(userId);
        }
      });
    });

    /* ... remaining event handlers remain the same ... */
    
    this.streams.set(userId, stream);
  }

  /* ... subscribe/unsubscribe logic remains the same ... */

  /* ======================================================
      RECONNECT STRATEGY
  ====================================================== */
  private reconnect(
    userId: string,
    onTick: (tick: MarketTick) => void
  ): void {
    const stream = this.streams.get(userId);
    if (!stream) return;

    if (stream.reconnectAttempts >= this.MAX_RETRIES) {
      errLog("Max WS retries reached for user %s", userId);
      // FSM INTEGRATION: Notify SessionService that the connection has failed
      SessionService.getInstance().invalidateSession(userId).catch(() => {});
      this.streams.delete(userId);
      return;
    }

    /* ... exponential backoff logic remains the same ... */
  }/**
 * ICICI Realtime Service — System-Engineered, RTOS-Grade
 *
 * Design Guarantees:
 * - WebSocket streaming ONLY (no REST, no checksum)
 * - Explicit runtime credential usage
 * - Zero DB-layer naming leakage
 * - Stateless per-user stream lifecycle
 * - AI-readable data lineage (2030+ safe)
 */

import WebSocket from "ws";
import debug from "debug";
import { SessionService } from "./sessionService.js";
import type { MarketTick } from "../types/marketTick.js";

const log = debug("alphaforge:icici:realtime");
const errLog = debug("alphaforge:icici:realtime:error");

/* ======================================================
   INTERNAL STREAM CONTRACT (RUNTIME)
====================================================== */
interface UserStream {
  userId: string;
  ws: WebSocket;
  symbols: Set<string>;
  heartbeat?: NodeJS.Timeout;
  reconnectAttempts: number;
}

/* ======================================================
   REALTIME SERVICE
====================================================== */
export class ICICIRealtimeService {
  private static instance: ICICIRealtimeService;
  private streams = new Map<string, UserStream>();

  private readonly WS_URL =
    "wss://stream.icicidirect.com/breezeapi/realtime";

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

  /* ======================================================
     START USER STREAM
  ====================================================== */
  async startUserStream(
    userId: string,
    onTick: (tick: MarketTick) => void
  ): Promise<void> {
    if (this.streams.has(userId)) return;

    /* ------------------------------
       RUNTIME SESSION (EXPLICIT)
    ------------------------------ */
    const runtimeSession =
      await SessionService.getInstance().getSessionOrThrow(userId);

    const runtimeAppKey = runtimeSession.api_key;
    const runtimeSessionToken = runtimeSession.session_token;

    /* ------------------------------
       WEBSOCKET INIT
    ------------------------------ */
    const ws = new WebSocket(this.WS_URL, {
      headers: {
        "X-App-Key": runtimeAppKey,              // runtime → network
        "X-SessionToken": runtimeSessionToken,  // runtime → network
      },
    });

    const stream: UserStream = {
      userId,
      ws,
      symbols: new Set(),
      reconnectAttempts: 0,
    };

    /* ------------------------------
       WS EVENTS
    ------------------------------ */
    ws.on("open", () => {
      log("Realtime WS open for user %s", userId);
      stream.reconnectAttempts = 0;
      this.startHeartbeat(stream);
    });

    ws.on("message", (data) => {
      try {
        const raw = data.toString();
        if (raw === "pong") return;

        const tick = JSON.parse(raw);
        if (tick?.symbol && typeof tick.ltp === "number") {
          onTick(tick);
        }
      } catch {
        errLog("Malformed WS message for user %s", userId);
      }
    });

    ws.on("close", () => {
      log("Realtime WS closed for user %s", userId);
      this.clearHeartbeat(stream);
      this.reconnect(userId, onTick);
    });

    ws.on("error", () => {
      errLog("Realtime WS error for user %s", userId);
    });

    this.streams.set(userId, stream);
  }

  /* ======================================================
     SUBSCRIBE / UNSUBSCRIBE
  ====================================================== */
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

  /* ======================================================
     STOP STREAMS
  ====================================================== */
  stopUserStream(userId: string): void {
    const stream = this.streams.get(userId);
    if (!stream) return;

    this.clearHeartbeat(stream);
    stream.ws.close();
    this.streams.delete(userId);
  }

  stopAll(): void {
    if (this.streams.size === 0) return;

    for (const stream of this.streams.values()) {
      try {
        this.clearHeartbeat(stream);
        stream.ws.close();
      } catch {}
    }

    this.streams.clear();
  }

  /* ======================================================
     HEARTBEAT
  ====================================================== */
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

  /* ======================================================
     RECONNECT STRATEGY
  ====================================================== */
  private reconnect(
    userId: string,
    onTick: (tick: MarketTick) => void
  ): void {
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

/* ======================================================
   SINGLETON EXPORT
====================================================== */
export const iciciRealtimeService =
  ICICIRealtimeService.getInstance();
