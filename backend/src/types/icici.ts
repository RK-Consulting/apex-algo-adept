// backend/src/types/icici.ts

/**
 * ICICI Finite State Machine (FSM) Type Definitions
 * Aligned with Database Check Constraints & Institutional-Grade Logic
 */

export type IciciState =
  | "IDLE"               // Initial state, no attempt made
  | "LOGIN_INITIATED"    // User redirected to ICICI, waiting for callback
  | "CALLBACK_RECEIVED"  // Surgical: ICICI pinged us, currently exchanging apisession for token
  | "SESSION_ACTIVE"     // Handshake complete, token stored in Redis/DB
  | "FAILED"             // Error during callback or credential exchange
  | "LOCKED";            // Rate-limited or security lockout (MAX_ATTEMPTS reached)

/**
 * Metadata for a specific login attempt
 */
export interface IciciLoginAttempt {
  user_id: string;
  state: IciciState;
  attempts: number;
  locked_until: Date | null;
  last_attempt_at: Date;
  updated_at: Date;
  last_error_message?: string; // Surgical: Useful for Aggregator dashboard diagnostics
}

/**
 * Guard Configuration Interface
 */
export interface IciciGuardConfig {
  requireProfileComplete?: boolean;
  requireCredentials?: boolean;
  disallowIfSessionActive?: boolean;
  allowWhileInitiated?: boolean;
}

/**
 * Helper to determine if a state requires a fresh login
 */
export const isTerminalState = (state: IciciState): boolean => {
  return ["IDLE", "FAILED", "LOCKED"].includes(state);
};

/**
 * Helper to check if the session is in a "Busy" transient state
 */
export const isHandshakeInProgress = (state: IciciState): boolean => {
  return ["LOGIN_INITIATED", "CALLBACK_RECEIVED"].includes(state);
};
