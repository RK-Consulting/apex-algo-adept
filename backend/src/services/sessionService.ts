// backend/src/services/sessionService.ts
/**
 * SessionService - Secure ICICI Breeze Session Management
 *
 * Architecture:
 * - Singleton for consistent access
 * - Redis caching (explicit TTL)
 * - PostgreSQL persistent storage
 * - Credentials stored encrypted in DB
 * - No apisession persistence
 */

import pool from "../config/database.js";
import debug from "debug";
import {
  getCachedSession,
  cacheSession,
  invalidateSessionCache,
} from "./cache.js";
import { decryptICICICredentials } from "../utils/crypto.js";

const log = debug("alphaforge:session");

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
      log("SessionService instance created");
    }
    return this.instance;
  }

  /**
   * Returns a fully usable ICICI session:
   * - api_key
   * - api_secret
   * - session_token
   */
  async getSession(userId: string): Promise<IciciSession | null> {
    // 1️⃣ Redis first
    const cached = await getCachedSession(userId);
    if (cached) {
      return cached as IciciSession;
    }

    log("Cache MISS for user %s, querying DB", userId);

    // 2️⃣ Fetch encrypted ICICI credentials
    const credRes = await pool.query(
      `
      SELECT icici_credentials
      FROM user_credentials
      WHERE user_id = $1 AND broker_name = 'icici'
      `,
      [userId]
    );

    if (
      credRes.rowCount === 0 ||
      !credRes.rows[0]?.icici_credentials
    ) {
      return null;
    }

    const { api_key, api_secret } = decryptICICICredentials(
      credRes.rows[0].icici_credentials
    );

    // 3️⃣ Fetch latest ICICI session token
    const sessionRes = await pool.query(
      `
      SELECT session_token, username, created_at
      FROM icici_sessions
      WHERE idirect_userid = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    if (sessionRes.rowCount === 0) {
      return null;
    }

    const session: IciciSession = {
      api_key,
      api_secret,
      session_token: sessionRes.rows[0].session_token,
      user_details: {
        username: sessionRes.rows[0].username,
      },
      connected_at: sessionRes.rows[0].created_at,
    };

    // 4️⃣ Cache (1 hour)
    await cacheSession(userId, session, 3600);

    return session;
  }

  /**
   * Save / update ICICI session token
   */
  async saveSession(
    userId: string,
    sessionData: {
      session_token: string;
      username?: string;
    }
  ): Promise<void> {
    await pool.query(
      `
      INSERT INTO icici_sessions (idirect_userid, session_token, username)
      VALUES ($1, $2, $3)
      `,
      [userId, sessionData.session_token, sessionData.username || null]
    );

    await invalidateSessionCache(userId);
    log("Session saved for user %s", userId);
  }

  /**
   * Invalidate session (logout / expiry)
   */
  async invalidateSession(userId: string): Promise<void> {
    await invalidateSessionCache(userId);
    await pool.query(
      `DELETE FROM icici_sessions WHERE idirect_userid = $1`,
      [userId]
    );
    log("Session invalidated for user %s", userId);
  }

  async hasValidSession(userId: string): Promise<boolean> {
    return !!(await this.getSession(userId));
  }

  async getSessionOrThrow(userId: string): Promise<IciciSession> {
    const session = await this.getSession(userId);
    if (!session) {
      throw new Error("ICICI not connected. Please authenticate first.");
    }
    return session;
  }
}
