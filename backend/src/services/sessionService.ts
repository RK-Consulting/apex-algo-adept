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
// backend/src/services/sessionService.ts

import pool from "../config/database.js";
import debug from "debug";
import axios from "axios";
import { decryptJSON } from "../utils/credentialEncryptor.js";

import {
  getCachedSession,
  cacheSession,
  invalidateSessionCache,
} from "./cache.js";

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
   * ==========================================================
   * Fetch + decrypt ICICI credentials from DB
   * ==========================================================
   */
  async getUserICICICredentials(userId: string): Promise<{
    api_key: string;
    api_secret: string;
  } | null> {
    const result = await pool.query(
      `
      SELECT icici_credentials
      FROM broker_credentials
      WHERE user_id = $1 AND broker_name = 'icici'
      `,
      [userId]
    );

    if (result.rowCount === 0 || !result.rows[0].icici_credentials) {
      return null;
    }

    return decryptJSON(result.rows[0].icici_credentials);
  }

  /**
   * ==========================================================
   * Exchange apisession → Breeze session_token
   * ==========================================================
   */
  async createICICISession(
    userId: string,
    apisession: string
  ): Promise<IciciSession> {
    const creds = await this.getUserICICICredentials(userId);

    if (!creds) {
      throw new Error("ICICI credentials not configured");
    }

    const { api_key, api_secret } = creds;

    /**
     * Breeze CustomerDetails API
     * (this exchanges apisession → session_token)
     */
    const response = await axios.post(
      "https://api.icicidirect.com/breezeapi/api/v1/customerdetails",
      {},
      {
        headers: {
          "X-AppKey": api_key,
          "X-SessionToken": apisession,
          "X-Checksum": "",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data?.Success?.session_token) {
      throw new Error("Failed to obtain Breeze session_token");
    }

    const session_token = response.data.Success.session_token;
    const user_details = response.data.Success;

    /**
     * Persist session
     */
    await pool.query(
      `
      INSERT INTO icici_sessions (idirect_userid, session_token, username)
      VALUES ($1, $2, $3)
      ON CONFLICT (idirect_userid)
      DO UPDATE SET
        session_token = EXCLUDED.session_token,
        created_at = now()
      `,
      [userId, session_token, user_details?.idirect_userid || null]
    );

    const session: IciciSession = {
      api_key,
      api_secret,
      session_token,
      user_details,
      connected_at: new Date(),
    };

    await cacheSession(userId, session, 3600);
    log("ICICI session created for user %s", userId);

    return session;
  }

    /**
   * ==========================================================
   * Persist ICICI session (called from authCallback route)
   * ==========================================================
   */
  async saveSession(
    userId: string,
    sessionData: {
      session_token: string;
      user_details?: any;
    }
  ): Promise<void> {
    await pool.query(
      `
      INSERT INTO icici_sessions (idirect_userid, session_token, username)
      VALUES ($1, $2, $3)
      ON CONFLICT (idirect_userid)
      DO UPDATE SET
        session_token = EXCLUDED.session_token,
        created_at = now()
      `,
      [
        userId,
        sessionData.session_token,
        sessionData.user_details?.idirect_userid || null,
      ]
    );

    await invalidateSessionCache(userId);
    log("ICICI session saved for user %s", userId);
  }

  /**
   * ==========================================================
   * Cached session fetch
   * ==========================================================
   */
  async getSession(userId: string): Promise<IciciSession | null> {
    const cached = await getCachedSession(userId);
    if (cached) return cached as IciciSession;

    const result = await pool.query(
      `
      SELECT
        s.session_token,
        c.icici_credentials
      FROM icici_sessions s
      JOIN broker_credentials c ON c.user_id = s.idirect_userid
      WHERE s.idirect_userid = $1
      `,
      [userId]
    );

    if (result.rowCount === 0) return null;

    const creds = decryptJSON(result.rows[0].icici_credentials);

    const session: IciciSession = {
      api_key: creds.api_key,
      api_secret: creds.api_secret,
      session_token: result.rows[0].session_token,
    };

    await cacheSession(userId, session, 3600);
    return session;
  }

  async invalidateSession(userId: string): Promise<void> {
    await invalidateSessionCache(userId);
    await pool.query(
      "DELETE FROM icici_sessions WHERE idirect_userid = $1",
      [userId]
    );
    log("ICICI session invalidated for user %s", userId);
  }

  async getSessionOrThrow(userId: string): Promise<IciciSession> {
    const session = await this.getSession(userId);
    if (!session) {
      throw new Error("ICICI not connected");
    }
    return session;
  }
}

