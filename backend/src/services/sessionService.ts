// backend/src/services/sessionService.ts
/**
 * SessionService - Secure ICICI Breeze Session Management
 *
 * Architecture:
 * - Singleton for consistent access
 * - Redis caching (explicit TTL) for low-latency retrieval
 * - PostgreSQL persistent storage
 * - No temporary apisession stored
 * - Strict typing for safety in trading context
 *
 * Production deployment: Ubuntu/DigitalOcean + Nginx + PM2
 */

import pool from '../config/database.js';
import debug from 'debug';
import { getCachedSession, cacheSession, invalidateSessionCache } from './cache';

const log = debug('alphaforge:session');

export interface IciciSession {
  api_key: string;
  api_secret: string;
  session_token: string;
  user_details?: any;
  connected_at?: Date;
}

export class SessionService {
  private static instance: SessionService;

  private constructor() {}

  static getInstance(): SessionService {
    if (!this.instance) {
      this.instance = new SessionService();
      log('SessionService instance created');
    }
    return this.instance;
  }

  async getSession(userId: string): Promise<IciciSession | null> {
    // Redis cache first
    const cached = await getCachedSession(userId);
    if (cached) {
      return cached as IciciSession;
    }

    log('Cache MISS for user %s, querying DB', userId);

    const result = await pool.query<IciciSession>(`
      SELECT
        c.api_key,
        c.api_secret,
        t.session_token,
        t.user_details,
        t.connected_at
      FROM icici_credentials c
      LEFT JOIN icici_breeze_tokens t ON c.user_id = t.user_id
      WHERE c.user_id = $1
    `, [userId]);

    if (result.rows.length === 0 || !result.rows[0].session_token) {
      return null;
    }

    const session = result.rows[0];

    // Cache with explicit TTL (1 hour)
    await cacheSession(userId, session, 3600);

    return session;
  }

  async saveSession(userId: string, sessionData: {
    session_token: string;
    user_details?: any;
  }): Promise<void> {
    await pool.query(`
      INSERT INTO icici_breeze_tokens
      (user_id, session_token, user_details, connected_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        session_token = EXCLUDED.session_token,
        user_details = EXCLUDED.user_details,
        connected_at = NOW()
    `, [
      userId,
      sessionData.session_token,
      sessionData.user_details ? JSON.stringify(sessionData.user_details) : null
    ]);

    await invalidateSessionCache(userId);
    log('Session saved for user %s', userId);
  }

  async invalidateSession(userId: string): Promise<void> {
    await invalidateSessionCache(userId);
    await pool.query(
      'DELETE FROM icici_breeze_tokens WHERE user_id = $1',
      [userId]
    );
    log('Session invalidated for user %s', userId);
  }

  async hasValidSession(userId: string): Promise<boolean> {
    return !!(await this.getSession(userId));
  }

  async getSessionOrThrow(userId: string): Promise<IciciSession> {
    const session = await this.getSession(userId);
    if (!session) {
      throw new Error('ICICI not connected. Please authenticate first.');
    }
    return session;
  }
}
