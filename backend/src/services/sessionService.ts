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

// backend/src/services/sessionService.ts

import redis from "../config/redis.js";
import { query } from "../config/database.js";
import debug from "debug";

const log = debug("alphaforge:session");

export interface IciciSession {
  api_key: string;      
  api_secret: string;   
  session_token: string;
  user_details?: any;
}

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
      SAVE SESSION (REDIS + icici_sessions Table)
  ===================================================== */
  async saveSession(
    userId: string,
    sessionData: IciciSession 
  ): Promise<void> {
    const sessionKey = `icici:session:${userId}`;

    try {
      // 1. Store in Redis (fast access for the Connector)
      await this.redis.set(
        sessionKey,
        JSON.stringify(sessionData),
        "EX",
        86400 // 24 hours
      );

      // 2. Store in icici_sessions (Primary Source of Truth for the Aggregator)
      // Note: We map sessionData.session_token to icici_sessions table
      await query(
        `INSERT INTO icici_sessions (user_id, session_token, created_at)
         VALUES ($1::uuid, $2, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET session_token = $2, created_at = NOW()`,
        [userId, sessionData.session_token]
      );

      // 3. Update broker_credentials last_connected only (Objective 2: Aggregator)
      await query(
        `UPDATE broker_credentials
         SET last_connected = NOW()
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );

      log("✅ Institutional Session saved for user:", userId);
    } catch (err: any) {
      log("❌ Error saving session:", err.message);
      throw err;
    }
  }

  /* =====================================================
      GET SESSION (REDIS → DB JOIN FALLBACK)
  ===================================================== */
  async getSession(userId: string): Promise<IciciSession | null> {
    const sessionKey = `icici:session:${userId}`;

    try {
      // 1. Try Redis first (fast path for High Frequency Trading)
      const cached = await this.redis.get(sessionKey);
      if (cached) {
        return JSON.parse(cached) as IciciSession;
      }

      log("⚠️ Session not in Redis, checking DB via Join for user:", userId);

      // 2. Fallback: JOIN icici_sessions (token) with broker_credentials (keys)
      const result = await query(
        `SELECT s.session_token, c.app_key, c.app_secret
         FROM icici_sessions s
         JOIN broker_credentials c ON s.user_id = c.user_id
         WHERE s.user_id = $1::uuid 
           AND c.broker_name = 'ICICI' 
           AND c.is_active = true`,
        [userId]
      );

      if (result.rowCount === 0) {
        log("❌ No active session found in DB for user:", userId);
        return null;
      }

      const row = result.rows[0];
      const sessionData: IciciSession = {
        api_key: row.app_key,
        api_secret: row.app_secret,
        session_token: row.session_token,
      };

      // 3. Re-cache in Redis
      await this.redis.set(
        sessionKey,
        JSON.stringify(sessionData),
        "EX",
        86400
      );

      return sessionData;
    } catch (err: any) {
      log("❌ Error retrieving session:", err.message);
      return null;
    }
  }

  async getSessionOrThrow(userId: string): Promise<IciciSession> {
    const session = await this.getSession(userId);
    if (!session) {
      const error = new Error(`No active ICICI session. Please login.`);
      (error as any).statusCode = 412; // Precondition Failed (State Machine error)
      throw error;
    }
    return session;
  }
  
  /* =====================================================
      INVALIDATE SESSION (The "Clean Break")
  ===================================================== */
  async invalidateSession(userId: string): Promise<void> {
    const sessionKey = `icici:session:${userId}`;

    try {
      // 1. Wipe Redis
      await this.redis.del(sessionKey);

      // 2. Wipe icici_sessions table
      await query(`DELETE FROM icici_sessions WHERE user_id = $1::uuid`, [userId]);

      // 3. Reset FSM to IDLE (Critical for State Machine)
      await query(
        `UPDATE icici_login_attempts 
         SET state = 'IDLE', updated_at = NOW() 
         WHERE user_id = $1::uuid`,
        [userId]
      );

      log("✅ Session fully purged for user:", userId);
    } catch (err: any) {
      log("❌ Error invalidating session:", err.message);
      throw err;
    }
  }

  async hasActiveSession(userId: string): Promise<boolean> {
    const session = await this.getSession(userId);
    return session !== null && !!session.session_token;
  }
}
