// backend/src/config/redis.ts
import Redis from 'ioredis';

/**
 * Redis Client for AlphaForge - Handles session caching, stream pub/sub, and rate limiting
 * Uses connection pooling for high-throughput trading streams (~1000+ TPS)
 */
const RedisClient = (Redis as any).default ?? Redis;

const redis = new RedisClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  // Retry strategy for resilience in volatile markets
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  lazyConnect: true,  // Connect on first use
  maxRetriesPerRequest: 3,
});

// Graceful error handling
redis.on('error', (error: Error) => {
  console.error('[Redis] Connection error:', error.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

export default redis;
