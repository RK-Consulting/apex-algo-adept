// backend/src/services/sessionService.ts
import pool from '../config/database';
import { getCachedSession, cacheSession, invalidateSessionCache } from './cache';

/**
 * SessionService - Manages ICICI session tokens with Redis caching
 * Singleton pattern ensures only one instance exists
 */
export class SessionService {
  private static instance: SessionService;

  // Private constructor prevents direct instantiation
  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SessionService {
    if (!this.instance) {
      this.instance = new SessionService();
      console.log('[SessionService] Instance created');
    }
    return this.instance;
  }

  /**
   * Get user's ICICI session (checks Redis cache first, then database)
   * 
   * Returns null if user has no credentials or not connected
   * Returns session object with: api_key, api_secret, session_token, apisession
   */
  async getSession(userId: string) {
    try {
      // 1. Try Redis cache first (fast! ~5ms)
      const cached = await getCachedSession(userId);
      if (cached) {
        console.log(`[SessionService] Cache HIT for user ${userId}`);
        return cached;
      }

      console.log(`[SessionService] Cache MISS for user ${userId}, checking database...`);

      // 2. Not in cache, query database (~50ms)
      const result = await pool.query(`
        SELECT 
          c.api_key,
          c.api_secret,
          t.session_token,
          t.apisession,
          t.user_details,
          t.connected_at
        FROM icici_credentials c
        LEFT JOIN icici_breeze_tokens t ON c.user_id = t.user_id
        WHERE c.user_id = $1
      `, [userId]);

      // 3. Check if user exists
      if (result.rows.length === 0) {
        console.log(`[SessionService] No credentials found for user ${userId}`);
        return null;
      }

      const session = result.rows[0];

      // 4. Check if user is connected (has session_token)
      if (!session.session_token) {
        console.log(`[SessionService] User ${userId} has credentials but not connected`);
        return null;
      }

      // 5. Cache for 1 hour (3600 seconds)
      await cacheSession(userId, session);
      console.log(`[SessionService] Cached session for user ${userId}`);

      return session;

    } catch (error: any) {
      console.error(`[SessionService] Error getting session for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get user's ICICI credentials (api_key, api_secret)
   * Returns null if no credentials found
   * 
   * This is used for login initiation or configuration checks
   */
  async getCredentials(userId: string): Promise<{ api_key: string; api_secret: string } | null> {
    try {
      const result = await pool.query(`
        SELECT api_key, api_secret
        FROM icici_credentials
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        console.log(`[SessionService] No credentials found for user ${userId}`);
        return null;
      }

      const credentials = result.rows[0];
      console.log(`[SessionService] Retrieved credentials for user ${userId}`);

      return credentials;

    } catch (error: any) {
      console.error(`[SessionService] Error getting credentials for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Save or update user's session after successful authentication
   */
  async saveSession(userId: string, sessionData: {
    session_token: string;
    apisession: string;
    user_details?: any;
  }) {
    try {
      await pool.query(`
        INSERT INTO icici_breeze_tokens 
        (user_id, session_token, apisession, user_details, connected_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          session_token = EXCLUDED.session_token,
          apisession = EXCLUDED.apisession,
          user_details = EXCLUDED.user_details,
          connected_at = NOW()
      `, [
        userId,
        sessionData.session_token,
        sessionData.apisession,
        sessionData.user_details ? JSON.stringify(sessionData.user_details) : null
      ]);

      await invalidateSessionCache(userId);
      console.log(`[SessionService] Saved session for user ${userId}`);

    } catch (error: any) {
      console.error(`[SessionService] Error saving session:`, error.message);
      throw error;
    }
  }

  /**
   * Delete user's session (logout or session expired)
   */
  async invalidateSession(userId: string) {
    try {
      await invalidateSessionCache(userId);
      await pool.query(
        'DELETE FROM icici_breeze_tokens WHERE user_id = $1',
        [userId]
      );
      console.log(`[SessionService] Invalidated session for user ${userId}`);

    } catch (error: any) {
      console.error(`[SessionService] Error invalidating session:`, error.message);
      throw error;
    }
  }

  /**
   * Check if user has valid session
   */
  async hasValidSession(userId: string): Promise<boolean> {
    const session = await this.getSession(userId);
    return session !== null && !!session.session_token;
  }

  /**
   * Get session or throw error if not found
   * Useful for middleware that requires valid session
   */
  async getSessionOrThrow(userId: string) {
    const session = await this.getSession(userId);
    if (!session) {
      throw new Error('ICICI not connected. Please authenticate first.');
    }
    return session;
  }
}

// Export singleton instance for convenience (optional - you can also use SessionService.getInstance())
export const sessionService = SessionService.getInstance();
