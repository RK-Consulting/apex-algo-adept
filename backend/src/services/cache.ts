// backend/src/services/cache.ts
import Redis from "ioredis";
import debug from "debug";
import type { IciciSession } from "./sessionService.js";

const RedisClient = (Redis as any).default ?? Redis;

const log = debug("alphaforge:cache");

const redis = new RedisClient(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("connect", () => {
  log("Redis connected");
});

redis.on("error", (err: Error) => {
  log("Redis error: %s", err.message);
});

// -----------------------------
// ICICI SESSION CACHE
// -----------------------------

export async function getCachedSession(
  userId: string
): Promise<IciciSession | null> {
  try {
    const cached = await redis.get(`icici:session:${userId}`);
    return cached ? (JSON.parse(cached) as IciciSession) : null;
  } catch (err) {
    log("Error getting cached session for user %s", userId);
    return null;
  }
}

export async function cacheSession(
  userId: string,
  session: IciciSession,
  ttlSeconds: number
): Promise<void> {
  try {
    await redis.set(
      `icici:session:${userId}`,
      JSON.stringify(session),
      "EX",
      ttlSeconds
    );
  } catch (err) {
    log("Error caching session for user %s", userId);
  }
}

export async function invalidateSessionCache(userId: string): Promise<void> {
  try {
    await redis.del(`icici:session:${userId}`);
  } catch (err) {
    log("Error invalidating session cache for user %s", userId);
  }
}

// -----------------------------
// MARKET DATA CACHE (SHORT TTL)
// -----------------------------

export async function getCachedQuote(
  symbol: string,
  exchange: string
): Promise<any | null> {
  try {
    const cached = await redis.get(`quote:${exchange}:${symbol}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export async function cacheQuote(
  symbol: string,
  exchange: string,
  quote: any,
  ttlSeconds = 5
): Promise<void> {
  try {
    await redis.set(
      `quote:${exchange}:${symbol}`,
      JSON.stringify(quote),
      "EX",
      ttlSeconds
    );
  } catch {
    /* silent */
  }
}
