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

import pool from "../config/database.js";
import debug from "debug";
import axios from "axios";

import {
  getCachedSession,
  cacheSession,
  invalidateSessionCache,
} from "./cache.js";

const log = debug("alphaforge:session");

/* ======================================================
   SESSION CONTRACT
====================================================== */
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
   * ======================================================
   * Fetch ICICI credentials from broker_credentials
   * ======================================================
   */
  async getUserICICICredentials(
    userId: string
  ): Promise<{ app_key: string; app_secret: string } | null> {
    /* ------------------------------
       SERVER CONTEXT
    ------------------------------ */
    const serverUserId = userId;

    /* ------------------------------
       DB QUERY
    ------------------------------ */
    const dbResult = await pool.query(
      `
      SELECT app_key, app_secret
      FROM broker_credentials
      WHERE user_id = $1
        AND broker_name = 'ICICI'
        AND is_active = true
      `,
      [serverUserId]
    );

    if ((dbResult.rowCount ?? 0) === 0) {
      return null;
    }

    /* ------------------------------
       DB → SERVER PAYLOAD
    ------------------------------ */
    const serverAppKey = dbResult.rows[0].app_key;
    const serverAppSecret = dbResult.rows[0].app_secret;

    return {
      app_key: serverAppKey,
      app_secret: serverAppSecret,
    };
  }

  /**
   * ======================================================
   * Exchange apisession → Breeze session_token
   * ======================================================
   */
  async createICICISession(
    userId: string,
    apisession: string
  ): Promise<IciciSession> {
    /* ------------------------------
       SERVER CONTEXT
    ------------------------------ */
    const serverUserId = userId;
    const reqApiSession = apisession;

    const credentials = await this.getUserICICICredentials(serverUserId);
    if (!credentials) {
      throw new Error("ICICI credentials not configured");
    }

    /* ------------------------------
       RUNTIME CREDENTIALS
    ------------------------------ */
    const runtimeAppKey = credentials.app_key;
    const runtimeAppSecret = credentials.app_secret;

    /* ------------------------------
       ICICI API CALL
    ------------------------------ */
    const response = await axios.post(
      "https://api.icicidirect.com/breezeapi/api/v1/customerdetails",
      {},
      {
        headers: {
          "X-AppKey": runtimeAppKey,
          "X-SessionToken": reqApiSession,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data?.Success?.session_token) {
      throw new Error("Failed to obtain Breeze session_token");
    }

    /* ------------------------------
       SESSION EXTRACTION
    ------------------------------ */
    const sessionToken = response.data.Success.session_token;
    const userDetails = response.data.Success;

    /* ------------------------------
       DB PERSISTENCE
    ------------------------------ */
    await pool.query(
      `
      INSERT INTO icici_sessions (idirect_userid, session_token, username)
      VALUES ($1, $2, $3)
      ON CONFLICT (idirect_userid)
      DO UPDATE SET
        session_token = EXCLUDED.session_token,
        created_at = now()
      `,
      [serverUserId, sessionToken, userDetails?.idirect_userid || null]
    );

    const session: IciciSession = {
      api_key: runtimeAppKey,
      api_secret: runtimeAppSecret,
      session_token: sessionToken,
      user_details: userDetails,
      connected_at: new Date(),
    };

    await cacheSession(serverUserId, session, 3600);
    log("ICICI session created for user %s", serverUserId);

    return session;
  }

  /**
   * ======================================================
   * Persist ICICI session (used by authCallback)
   * ======================================================
   */
  async saveSession(
    userId: string,
    sessionData: {
      session_token: string;
      user_details?: any;
    }
  ): Promise<void> {
    const serverUserId = userId;
    const runtimeSessionToken = sessionData.session_token;

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
        serverUserId,
        runtimeSessionToken,
        sessionData.user_details?.idirect_userid || null,
      ]
    );

    await invalidateSessionCache(serverUserId);
    log("ICICI session saved for user %s", serverUserId);
  }

  /**
   * ======================================================
   * Cached session fetch
   * ======================================================
   */
  async getSession(userId: string): Promise<IciciSession | null> {
    const serverUserId = userId;

    const cached = await getCachedSession(serverUserId);
    if (cached) return cached as IciciSession;

    const dbResult = await pool.query(
      `
      SELECT
        s.session_token,
        c.app_key,
        c.app_secret
      FROM icici_sessions s
      JOIN broker_credentials c
        ON c.user_id = s.idirect_userid
      WHERE s.idirect_userid = $1
        AND c.broker_name = 'ICICI'
        AND c.is_active = true
      `,
      [serverUserId]
    );

    if ((dbResult.rowCount ?? 0) === 0) {
      return null;
    }

    /* ------------------------------
       RUNTIME MATERIALIZATION
    ------------------------------ */
    const runtimeAppKey = dbResult.rows[0].app_key;
    const runtimeAppSecret = dbResult.rows[0].app_secret;
    const runtimeSessionToken = dbResult.rows[0].session_token;

    const session: IciciSession = {
      api_key: runtimeAppKey,
      api_secret: runtimeAppSecret,
      session_token: runtimeSessionToken,
    };

    await cacheSession(serverUserId, session, 3600);
    return session;
  }

  async invalidateSession(userId: string): Promise<void> {
    const serverUserId = userId;

    await invalidateSessionCache(serverUserId);
    await pool.query(
      "DELETE FROM icici_sessions WHERE idirect_userid = $1",
      [serverUserId]
    );

    log("ICICI session invalidated for user %s", serverUserId);
  }

  async getSessionOrThrow(userId: string): Promise<IciciSession> {
    const session = await this.getSession(userId);
    if (!session) {
      throw new Error("ICICI not connected");
    }
    return session;
  }
}
