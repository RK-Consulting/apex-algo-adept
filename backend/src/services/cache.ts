// backend/src/services/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

/**
 * Cache user's ICICI session (1 hour)
 */
export async function getCachedSession(userId: string) {
  try {
    const cached = await redis.get(`session:${userId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('[Cache] Error getting session:', error);
    return null;
  }
}

export async function cacheSession(userId: string, session: any) {
  try {
    await redis.setex(
      `session:${userId}`,
      3600, // 1 hour
      JSON.stringify(session)
    );
  } catch (error) {
    console.error('[Cache] Error caching session:', error);
  }
}

export async function invalidateSessionCache(userId: string) {
  try {
    await redis.del(`session:${userId}`);
  } catch (error) {
    console.error('[Cache] Error invalidating session:', error);
  }
}

/**
 * Cache stock quotes (5 seconds)
 */
export async function getCachedQuote(stockCode: string) {
  try {
    const cached = await redis.get(`quote:${stockCode}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('[Cache] Error getting quote:', error);
    return null;
  }
}

export async function cacheQuote(stockCode: string, quote: any) {
  try {
    await redis.setex(
      `quote:${stockCode}`,
      5, // 5 seconds
      JSON.stringify(quote)
    );
  } catch (error) {
    console.error('[Cache] Error caching quote:', error);
  }
}
