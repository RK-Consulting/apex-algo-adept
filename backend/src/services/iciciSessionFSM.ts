// backend/src/services/iciciSessionFSM.ts

import { query } from "../config/database.js";
import debug from "debug";
// Use the expanded type we defined earlier
export type IciciState = "IDLE" | "LOGIN_INITIATED" | "CALLBACK_RECEIVED" | "SESSION_ACTIVE" | "FAILED" | "LOCKED";

const log = debug("alphaforge:icici:fsm");

export class IciciSessionFSM {
  /* =====================================================
      READ CURRENT STATE (Surgical: Pointing to login_attempts)
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
      ASSERT TRANSITION (Surgical: Added handshake states)
  ===================================================== */
  static assertAllowed(current: IciciState, next: IciciState) {
    const allowed: Record<IciciState, IciciState[]> = {
      IDLE: ["LOGIN_INITIATED"],
      LOGIN_INITIATED: ["CALLBACK_RECEIVED", "FAILED"],
      CALLBACK_RECEIVED: ["SESSION_ACTIVE", "FAILED"],
      SESSION_ACTIVE: ["IDLE", "FAILED"], // Logout or token expiry
      FAILED: ["IDLE", "LOGIN_INITIATED"],
      LOCKED: ["IDLE"], // Manual unlock or expiry handled by getState
    };

    if (!allowed[current]?.includes(next)) {
      log(`❌ Illegal ICICI transition: ${current} → ${next}`);
      throw new Error(`ICICI transition blocked: ${current} → ${next}`);
    }
  }

  /* =====================================================
      TRANSITION STATE (Surgical: DB targets & parameters)
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
      // General transition for IDLE, INITIATED, CALLBACK, ACTIVE
      await query(
        `INSERT INTO icici_login_attempts (user_id, state, updated_at)
         VALUES ($1::uuid, $2, now())
         ON CONFLICT (user_id) DO UPDATE SET state = $2, updated_at = now()`,
        [userId, to]
      );
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
}
