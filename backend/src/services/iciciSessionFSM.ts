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
