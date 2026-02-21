// backend/src/services/iciciSessionFSM.ts

import pool, { query } from "../config/database.js";
import redis from "../config/redis.js";
import { SessionService } from "./sessionService.js";
import debug from "debug";

export type IciciState = "IDLE" | "LOGIN_INITIATED" | "CALLBACK_RECEIVED" | "SESSION_ACTIVE" |
  "FAILED" | "LOCKED";

const log = debug("alphaforge:icici:fsm");

export class IciciSessionFSM {
  /* =====================================================
      READ CURRENT STATE
  ===================================================== */
  static async getState(userId: string): Promise<IciciState> {
    const res = await query(
      `SELECT state, locked_until FROM icici_login_attempts WHERE user_id = $1::uuid`,
      [userId]
    );
    if (res.rowCount === 0) return "IDLE";

    const row = res.rows[0];
    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      return "LOCKED";
    }

    return row.state as IciciState;
  }

  /* =====================================================
      ASSERT TRANSITION
  ===================================================== */
  static assertAllowed(current: IciciState, next: IciciState) {
    const allowed: Record<IciciState, IciciState[]> = {
      IDLE: ["LOGIN_INITIATED"],
      LOGIN_INITIATED: ["CALLBACK_RECEIVED", "FAILED"],
      CALLBACK_RECEIVED: ["SESSION_ACTIVE", "FAILED"],
      SESSION_ACTIVE: ["IDLE", "FAILED"],
      FAILED: ["IDLE", "LOGIN_INITIATED"],
      LOCKED: ["IDLE"],
    };
    if (!allowed[current]?.includes(next)) {
      log(`❌ Illegal ICICI transition: ${current} → ${next}`);
      throw new Error(`ICICI transition blocked: ${current} → ${next}`);
    }
  }

  /* =====================================================
      TRANSITION STATE
  ===================================================== */
  static async transition(
    userId: string,
    to: IciciState,
    options: { lockMinutes?: number; attempts?: number } = {}
  ) {
    const current = await this.getState(userId);
    this.assertAllowed(current, to);

    log(`🔁 ICICI FSM transition ${current} → ${to} (user=${userId})`);
    if (to === "LOCKED") {
      const lockMinutes = options.lockMinutes ?? 15;
      await query(
        `UPDATE icici_login_attempts 
         SET state = 'LOCKED', locked_until = now() + interval '${lockMinutes} minutes', updated_at = now()
         WHERE user_id = $1::uuid`,
        [userId]
      );
    } else {
      await query(
        `INSERT INTO icici_login_attempts (user_id, state, updated_at)
         VALUES ($1::uuid, $2, now())
         ON CONFLICT (user_id) DO UPDATE SET state = $2, updated_at = now()`,
        [userId, to]
      );
    }
  }

  /* =====================================================
      HARD RESET: Complete session cleanup with atomic transaction
      BUG 1 FIX: Removed dropped columns (session_token, session_expires_at,
      last_login_attempt, error_message) from broker_credentials UPDATE.
      These columns no longer exist in the table schema.
  ===================================================== */
  static async forceReset(userId: string): Promise<void> {
    log(`🔄 FORCE RESET initiated for user: ${userId}`);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Reset broker_credentials session state — only columns that exist
      await client.query(
        `UPDATE broker_credentials 
         SET is_active = false, updated_at = NOW()
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );

      // 2. Reset FSM state to IDLE and clear lockout
      await client.query(
        `UPDATE icici_login_attempts 
         SET state = 'IDLE', locked_until = NULL, attempts = 0, updated_at = NOW() 
         WHERE user_id = $1::uuid`,
        [userId]
      );

      // 3. Clear icici_sessions table
      await client.query(
        `DELETE FROM icici_sessions WHERE user_id = $1::uuid`,
        [userId]
      );

      // 4. Clear WebSocket subscriptions if table exists
      await client.query(
        `DELETE FROM icici_websocket_subscriptions WHERE user_id = $1::uuid`,
        [userId]
      ).catch(() => log("ℹ️ icici_websocket_subscriptions table not found, skipping."));

      await client.query('COMMIT');

      // 5. Clear Redis cache
      if (redis) {
        const keys = [`fsm:state:${userId}`, `session:${userId}`, `icici:session:${userId}`];
        await redis.del(...keys);
      }

      // 6. Invalidate memory cache
      await SessionService.getInstance().invalidateSession(userId);
      log(`✅ FORCE RESET complete for user: ${userId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      log(`❌ FORCE RESET failed: ${error}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /* =====================================================
      SOFT RESET: Only clear session token
      BUG 2 FIX: Removed dropped columns (session_token, session_expires_at)
      from broker_credentials UPDATE.
  ===================================================== */
  static async softReset(userId: string): Promise<void> {
    log(`🔄 SOFT RESET initiated for user: ${userId}`);
    try {
      // Only update columns that actually exist in broker_credentials
      await query(
        `UPDATE broker_credentials 
         SET is_active = false, updated_at = NOW()
         WHERE user_id = $1::uuid AND broker_name = 'ICICI'`,
        [userId]
      );
      // Clear the session from icici_sessions table instead
      await query(
        `DELETE FROM icici_sessions WHERE user_id = $1::uuid`,
        [userId]
      );
      await SessionService.getInstance().invalidateSession(userId);
    } catch (error) {
      log(`❌ SOFT RESET failed: ${error}`);
      throw error;
    }
  }

  /* =====================================================
      CHECK AND RESET IF STALE
  ===================================================== */
  static async checkAndResetIfStale(userId: string): Promise<void> {
    log(`🔍 Checking for stale session: ${userId}`);
    try {
      const result = await query(
        `SELECT b.is_active, b.updated_at, l.state, l.updated_at as last_fsm_update
         FROM broker_credentials b
         LEFT JOIN icici_login_attempts l ON b.user_id = l.user_id
         WHERE b.user_id = $1::uuid AND b.broker_name = 'ICICI'`,
        [userId]
      );
      if (result.rowCount === 0) return;

      const creds = result.rows[0];
      const now = Date.now();
      const thirtyMin = 30 * 60 * 1000;
      const fiveMin = 5 * 60 * 1000;
      const isStale = creds.is_active && (now - new Date(creds.updated_at).getTime() > thirtyMin);
      const isStuck = creds.state === 'LOGIN_INITIATED' && (now - new Date(creds.last_fsm_update).getTime() > fiveMin);
      if (isStale || isStuck) {
        log(`⚠️ Stale/Stuck session detected. Forcing reset.`);
        await this.forceReset(userId);
      }
    } catch (error) {
      log(`❌ Check stale failed: ${error}`);
    }
  }

  /* =====================================================
      GUARD HELPERS
  ===================================================== */
  static async requireActive(userId: string) {
    const state = await this.getState(userId);
    if (state !== "SESSION_ACTIVE") {
      throw new Error(`ICICI not active (state=${state}). Please connect broker.`);
    }
  }

  /* =====================================================
      GRACEFUL DISCONNECT
      BUG 3 FIX: Removed SELECT session_token FROM broker_credentials
      (column doesn't exist). Session token is now retrieved from
      icici_sessions table where it IS stored.
  ===================================================== */
  static async gracefulDisconnect(userId: string): Promise<void> {
    log("👋 GRACEFUL DISCONNECT initiated for user: %s", userId);
    try {
      // 1. Get session token from icici_sessions (where it's actually stored)
      const sessionResult = await query(
        `SELECT session_token FROM icici_sessions WHERE user_id = $1::uuid`,
        [userId]
      );
      const sessionToken = sessionResult.rows[0]?.session_token;

      if (sessionToken) {
        try {
          const breezeModule = await import('./breezeClient.js') as any;
          const breezeAxios = breezeModule.breezeAxios || breezeModule.default || breezeModule;

          if (breezeAxios && breezeAxios.post) {
            await breezeAxios.post('/api/v1/logout', {
              SessionToken: sessionToken
            }, {
              timeout: 5000
            });
            log("✅ ICICI logout API called successfully");
          } else {
            log("⚠️ breezeAxios not found in module, skipping logout call");
          }
        } catch (logoutError: any) {
          // Don't fail if ICICI logout fails — continue with cleanup
          log("⚠️ ICICI logout API failed (continuing cleanup): %s", logoutError.message);
        }
      }

      // 2. Force reset regardless of ICICI API result
      await this.forceReset(userId);
      log("✅ GRACEFUL DISCONNECT complete for user: %s", userId);
    } catch (error) {
      log("❌ GRACEFUL DISCONNECT failed for user: %s", userId, error);
      throw error;
    }
  }
}
