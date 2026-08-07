// backend/src/services/sessionService.ts

/**
 * SessionService - Secure ICICI Breeze Session Management
 *
 * Architecture:
 * - Singleton for consistent access
 * - Redis caching (explicit TTL, 24h)
 * - PostgreSQL persistent storage via icici_sessions table
 * - Credentials (app_key/app_secret) stored in broker_credentials
 *
 * BUG 5 FIX — Session recovery blocked:
 * getSession() DB fallback previously had AND c.is_active = true.
 * The connect route sets is_active=false on every login initiation to
 * invalidate old sessions. This meant: if Redis expired (after 24h) and
 * the user had reconnected since, the DB fallback would return null even
 * though icici_sessions had a valid token. Fixed by removing the is_active
 * filter — is_active is a signal to the status endpoint, not a session gate.
 */

import redis from "../../../config/redis.js";
import { query } from "../../../config/database.js";
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
  async saveSession(userId: string, sessionData: IciciSession): Promise<void> {
    const sessionKey = `icici:session:${userId}`;

    try {
      // 1. Store in Redis (fast path for API calls)
      await this.redis.set(sessionKey, JSON.stringify(sessionData), "EX", 86400);

      // 2. Store token in icici_sessions (durable fallback)
      await query(
        `INSERT INTO icici_sessions (user_id, session_token, created_at)
         VALUES ($1::uuid, $2, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET session_token = $2, created_at = NOW()`,
        [userId, sessionData.session_token]
      );

      // 3. Mark credentials active and record last_connected
      await query(
        `UPDATE broker_credentials
         SET is_active = true, last_connected = NOW(), updated_at = NOW()
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );

      log("✅ Session saved for user:", userId);
    } catch (err: any) {
      log("❌ Error saving session:", err.message);
      throw err;
    }
  }

  /* =====================================================
      GET SESSION (REDIS → DB FALLBACK)
      BUG 5 FIX: Removed AND c.is_active = true from DB fallback.
      is_active is set to false during every login initiation and
      restored only after successful auth. If Redis has expired and the
      user has an active session, the DB query must not filter on is_active
      or it will incorrectly return null.
  ===================================================== */
  async getSession(userId: string): Promise<IciciSession | null> {
    const sessionKey = `icici:session:${userId}`;

    try {
      // 1. Redis fast path
      const cached = await this.redis.get(sessionKey);
      if (cached) {
        return JSON.parse(cached) as IciciSession;
      }

      log("⚠️ Session not in Redis, checking DB for user:", userId);

      // 2. DB fallback: JOIN icici_sessions with broker_credentials for keys
      //    No is_active filter — is_active is managed by connect/disconnect flow
      //    and must not gate session reads.
      const result = await query(
        `SELECT s.session_token, c.app_key, c.app_secret
         FROM icici_sessions s
         JOIN broker_credentials c ON s.user_id = c.user_id
         WHERE s.user_id = $1::uuid
           AND c.broker_name = 'ICICI'`,
        [userId]
      );

      if (result.rowCount === 0) {
        log("❌ No session in DB for user:", userId);
        return null;
      }

      const row = result.rows[0];
      const sessionData: IciciSession = {
        api_key: row.app_key,
        api_secret: row.app_secret,
        session_token: row.session_token,
      };

      // 3. Re-cache in Redis to avoid repeated DB hits
      await this.redis.set(sessionKey, JSON.stringify(sessionData), "EX", 86400);

      return sessionData;
    } catch (err: any) {
      log("❌ Error retrieving session:", err.message);
      return null;
    }
  }

  async getSessionOrThrow(userId: string): Promise<IciciSession> {
    const session = await this.getSession(userId);
    if (!session) {
      const error = new Error("No active ICICI session. Please login.");
      (error as any).statusCode = 412;
      throw error;
    }
    return session;
  }

  /* =====================================================
      INVALIDATE SESSION
  ===================================================== */
  async invalidateSession(userId: string): Promise<void> {
    const sessionKey = `icici:session:${userId}`;

    try {
      // 1. Wipe Redis
      await this.redis.del(sessionKey);

      // 2. Wipe icici_sessions table
      await query(`DELETE FROM icici_sessions WHERE user_id = $1::uuid`, [userId]);

      // 3. Reset FSM to IDLE
      await query(
        `UPDATE icici_login_attempts
         SET state = 'IDLE', updated_at = NOW()
         WHERE user_id = $1::uuid`,
        [userId]
      );

      log("✅ Session purged for user:", userId);
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
