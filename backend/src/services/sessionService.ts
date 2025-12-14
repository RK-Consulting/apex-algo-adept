// backend/src/services/sessionService.ts
import pool from '../config/database';
import { getCachedSession, cacheSession, invalidateSessionCache } from './cache';

export class SessionService {
  private static instance: SessionService;

  // Singleton pattern - only one instance exists
  static getInstance() {
    if (!this.instance) {
      this.instance = new SessionService();
    }
    return this.instance;
  }

  /**
   * Get user's ICICI session (checks cache first, then database)
   */
  async getSession(userId: string) {
    try {
      // Try Redis cache first (fast!)
      const cached = await getCachedSession(userId);
      if (cached) {
        console.log(`[Session] Cache HIT for user ${userId}`);
        return cached;
      }

      console.log(`[Session] Cache MISS for user ${userId}, checking database...`);

      // Not in cache, check database
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

      if (result.rows.length === 0) {
        console.log(`[Session] No credentials found for user ${userId}`);
        return null;
      }

      const session = result.rows[0];

      if (!session.session_token) {
        console.log(`[Session] User ${userId} has credentials but not connected`);
        return null;
      }

      // Cache for 1 hour
      await cacheSession(userId, session);

      return session;

    } catch (error: any) {
      console.error(`[Session] Error getting session for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete user's session (logout)
   */
  async invalidateSession(userId: string) {
    try {
      // Remove from cache
      await invalidateSessionCache(userId);

      // Remove from database
      await pool.query(
        'DELETE FROM icici_breeze_tokens WHERE user_id = $1',
        [userId]
      );

      console.log(`[Session] Invalidated session for user ${userId}`);
    } catch (error: any) {
      console.error(`[Session] Error invalidating session:`, error.message);
      throw error;
    }
  }
  }
