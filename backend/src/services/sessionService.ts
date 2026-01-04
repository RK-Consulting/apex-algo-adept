// backend/src/services/sessionService.ts
/**
 * SessionService - Secure ICICI Breeze Session Management
 *
 * Architecture:
 * - Singleton for consistent access
 * - Redis caching (explicit TTL)
 * - PostgreSQL persistent storage
 * - Credentials stored in broker_credentials
 * - No apisession persistence
 */

/**
 * ICICI Session Management Service
 *
 * Responsibilities:
 * - Redis-backed session caching (fast)
 * - PostgreSQL session persistence (durable)
 * - Session lifecycle management
 *
 * Architecture Notes:
 * - Redis is primary (24h TTL)
 * - DB is fallback + audit trail
 * - Sessions include credentials for Breeze API calls
 */

import redis from "../config/redis.js";
import { query } from "../config/database.js";
import debug from "debug";

const log = debug("alphaforge:session");

/**
 * ICICI Session Structure
 * Stored in both Redis and PostgreSQL
 */
export interface IciciSession {
  api_key: string;        // ← ADDED
  api_secret: string;     // ← ADDED
  session_token: string;
  user_details?: any;
}

/**
 * Singleton Session Service
 * Ensures single Redis client across application
 */
export class SessionService {
  private static instance: SessionService;
  private redis = redis;

  private constructor() {}

  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /* =====================================================
     SAVE SESSION (REDIS + DB)
  ===================================================== */
  async saveSession(
    userId: string,
    sessionData: IciciSession  // ← CHANGED: now includes api_key, api_secret
  ): Promise<void> {
    const sessionKey = `icici:session:${userId}`;

    try {
      // 1. Store in Redis (fast access)
      await this.redis.set(
        sessionKey,
        JSON.stringify(sessionData),
        "EX",
        86400 // 24 hours
      );

      // 2. Store in DB (persistence + audit)
      await query(
        `INSERT INTO icici_sessions (user_id, session_token, created_at)
         VALUES ($1::uuid, $2, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET session_token = $2, created_at = NOW()`,
        [userId, sessionData.session_token]
      );

      // 3. Update broker_credentials with session_token
      await query(
        `UPDATE broker_credentials
         SET session_token = $2, last_connected = NOW()
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId, sessionData.session_token]
      );

      log("✅ Session saved for user:", userId);
    } catch (err: any) {
      log("❌ Error saving session:", err.message);
      throw err;
    }
  }

  /* =====================================================
     GET SESSION (REDIS → DB FALLBACK)
  ===================================================== */
  async getSession(userId: string): Promise<IciciSession | null> {
    const sessionKey = `icici:session:${userId}`;

    try {
      // 1. Try Redis first (fast path)
      const cached = await this.redis.get(sessionKey);
      if (cached) {
        log("✅ Session found in Redis for user:", userId);
        return JSON.parse(cached) as IciciSession;
      }

      log("⚠️ Session not in Redis, checking DB for user:", userId);

      // 2. Fallback to DB
      const result = await query(
        `SELECT bc.app_key, bc.app_secret, bc.session_token
         FROM broker_credentials bc
         WHERE bc.user_id = $1::uuid 
           AND bc.broker_name = 'ICICI' 
           AND bc.is_active = true
           AND bc.session_token IS NOT NULL`,
        [userId]
      );

      if (result.rowCount === 0) {
        log("❌ No session found in DB for user:", userId);
        return null;
      }

      const row = result.rows[0];
      const sessionData: IciciSession = {
        api_key: row.app_key,
        api_secret: row.app_secret,
        session_token: row.session_token,
      };

      // 3. Re-cache it in Redis
      await this.redis.set(
        sessionKey,
        JSON.stringify(sessionData),
        "EX",
        86400
      );

      log("✅ Session restored from DB to Redis for user:", userId);
      return sessionData;
    } catch (err: any) {
      log("❌ Error getting session:", err.message);
      return null;
    }
  }

  /* =====================================================
     INVALIDATE SESSION (REDIS + DB)
  ===================================================== */
  async invalidateSession(userId: string): Promise<void> {
    const sessionKey = `icici:session:${userId}`;

    try {
      // 1. Remove from Redis
      await this.redis.del(sessionKey);

      // 2. Clear session_token in DB
      await query(
        `UPDATE broker_credentials
         SET session_token = NULL
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );

      // 3. Update FSM state
      await query(
        `UPDATE icici_login_attempts
         SET state = 'IDLE', updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [userId]
      );

      log("✅ Session invalidated for user:", userId);
    } catch (err: any) {
      log("❌ Error invalidating session:", err.message);
      throw err;
    }
  }

  /* =====================================================
     CHECK IF SESSION EXISTS
  ===================================================== */
  async hasActiveSession(userId: string): Promise<boolean> {
    const session = await this.getSession(userId);
    return session !== null && !!session.session_token;
  }

  /* =====================================================
     GET SESSION TOKEN ONLY (FOR BREEZE API CALLS)
  ===================================================== */
  async getSessionToken(userId: string): Promise<string | null> {
    const session = await this.getSession(userId);
    return session?.session_token || null;
  }
}
