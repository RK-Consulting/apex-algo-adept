// backend/src/services/iciciSessionFSM.ts

import { query } from "../config/database.js";
import debug from "debug";

const log = debug("alphaforge:icici:fsm");

export class IciciSessionFSM {
  /* =====================================================
     READ CURRENT STATE
  ===================================================== */
  static async getState(userId: string): Promise<IciciState> {
    const res = await query(
      `
      SELECT
        session_token,
        expires_at,
        locked_until
      FROM icici_sessions
      WHERE user_id = $1
      `,
      [userId]
    );

    if (res.rowCount === 0) {
      return "NONE";
    }

    const row = res.rows[0];

    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      return "LOCKED";
    }

    if (!row.session_token) {
      return "CREDENTIALS_SAVED";
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return "SESSION_EXPIRED";
    }

    return "SESSION_ACTIVE";
  }

  /* =====================================================
     ASSERT TRANSITION IS ALLOWED
  ===================================================== */
  static assertAllowed(
    current: IciciState,
    next: IciciState
  ) {
    const allowed: Record<IciciState, IciciState[]> = {
      NONE: ["CREDENTIALS_SAVED"],
      CREDENTIALS_SAVED: ["AUTH_IN_PROGRESS"],
      AUTH_IN_PROGRESS: ["SESSION_ACTIVE", "LOCKED"],
      SESSION_ACTIVE: ["SESSION_EXPIRED"],
      SESSION_EXPIRED: ["AUTH_IN_PROGRESS", "LOCKED"],
      LOCKED: [], // must wait for unlock
    };

    if (!allowed[current].includes(next)) {
      log(`❌ Illegal ICICI state transition: ${current} → ${next}`);
      throw new Error(`ICICI transition blocked: ${current} → ${next}`);
    }
  }

  /* =====================================================
     TRANSITION STATE
  ===================================================== */
  static async transition(
    userId: string,
    from: IciciState,
    to: IciciState,
    options: {
      sessionToken?: string;
      expiresAt?: Date;
      lockMinutes?: number;
    } = {}
  ) {
    this.assertAllowed(from, to);

    log(`🔁 ICICI FSM transition ${from} → ${to} (user=${userId})`);

    if (to === "AUTH_IN_PROGRESS") {
      await query(
        `
        UPDATE icici_sessions
        SET auth_started_at = now()
        WHERE user_id = $1
        `,
        [userId]
      );
    }

    if (to === "SESSION_ACTIVE") {
      await query(
        `
        UPDATE icici_sessions
        SET
          session_token = $2,
          expires_at = $3,
          locked_until = NULL,
          updated_at = now()
        WHERE user_id = $1
        `,
        [userId, options.sessionToken, options.expiresAt]
      );
    }

    if (to === "SESSION_EXPIRED") {
      await query(
        `
        UPDATE icici_sessions
        SET session_token = NULL,
            updated_at = now()
        WHERE user_id = $1
        `,
        [userId]
      );
    }

    if (to === "LOCKED") {
      const lockMinutes = options.lockMinutes ?? 30;
      await query(
        `
        UPDATE icici_sessions
        SET locked_until = now() + interval '${lockMinutes} minutes'
        WHERE user_id = $1
        `,
        [userId]
      );
    }
  }

  /* =====================================================
     GUARD HELPERS
  ===================================================== */
  static async requireActive(userId: string) {
    const state = await this.getState(userId);
    if (state !== "SESSION_ACTIVE") {
      throw new Error(`ICICI not active (state=${state})`);
    }
  }

  static async requireNotLocked(userId: string) {
    const state = await this.getState(userId);
    if (state === "LOCKED") {
      throw new Error("ICICI temporarily locked due to failures");
    }
  }
}
