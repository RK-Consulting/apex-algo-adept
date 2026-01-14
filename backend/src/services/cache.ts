// backend/src/services/cache.ts
import redisConfig from "../config/redis.js";
import debug from "debug";
import type { IciciSession } from "./sessionService.js";
import type { MarketTick } from "../types/marketTick.js"; // Standardize your types

const log = debug("alphaforge:cache");
const redis = redisConfig;

/* ======================================================
   HEALTH & DIAGNOSTICS
====================================================== */
export async function isCacheAvailable(): Promise<boolean> {
  try {
    const ping = await redis.ping();
    return ping === "PONG";
  } catch {
    return false;
  }
}

/* ======================================================
   ICICI SESSION CACHE
   Note: Used by SessionService to maintain "Source of Truth"
====================================================== */
const SESSION_PREFIX = "icici:session:";

export async function getCachedSession(userId: string): Promise<IciciSession | null> {
  try {
    const cached = await redis.get(`${SESSION_PREFIX}${userId}`);
    return cached ? (JSON.parse(cached) as IciciSession) : null;
  } catch (err) {
    log("❌ Cache Read Error [User: %s]: %o", userId, err);
    return null;
  }
}

export async function cacheSession(
  userId: string,
  session: IciciSession,
  ttlSeconds: number = 86400 // Default 24h
): Promise<void> {
  try {
    await redis.set(
      `${SESSION_PREFIX}${userId}`,
      JSON.stringify(session),
      "EX",
      ttlSeconds
    );
  } catch (err) {
    log("❌ Cache Write Error [User: %s]", userId);
  }
}

export async function invalidateSessionCache(userId: string): Promise<void> {
  try {
    await redis.del(`${SESSION_PREFIX}${userId}`);
    log("🗑️ Cache cleared for user: %s", userId);
  } catch (err) {
    log("❌ Cache Del Error [User: %s]", userId);
  }
}

/* ======================================================
   MARKET DATA CACHE (HFT-Grade Short TTL)
   Ensures the Aggregator doesn't hammer ICICI for static prices
====================================================== */
const QUOTE_PREFIX = "quote:";

export async function getCachedQuote(
  symbol: string,
  exchange: string = "NSE"
): Promise<MarketTick | null> {
  try {
    const cached = await redis.get(`${QUOTE_PREFIX}${exchange}:${symbol}`);
    return cached ? (JSON.parse(cached) as MarketTick) : null;
  } catch {
    return null;
  }
}

export async function cacheQuote(
  symbol: string,
  exchange: string = "NSE",
  quote: MarketTick,
  ttlSeconds = 2 // Reduced TTL for active market hours
): Promise<void> {
  try {
    // Pipeline can be used here if caching multiple symbols at once
    await redis.set(
      `${QUOTE_PREFIX}${exchange}:${symbol}`,
      JSON.stringify(quote),
      "EX",
      ttlSeconds
    );
  } catch {
    /* Silent fail - system falls back to Live WS or REST */
  }
}
