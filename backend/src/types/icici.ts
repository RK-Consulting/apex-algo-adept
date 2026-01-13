// backend/src/types/icici.ts
/**
 * ICICI Finite State Machine (FSM) Type Definitions
 * Aligned with Database Check Constraints & Institutional-Grade Logic
 */

export type IciciState =
  | "IDLE"              // Initial state, no attempt made
  | "LOGIN_INITIATED"   // User redirected to ICICI, waiting for callback
  | "SESSION_ACTIVE"    // Handshake complete, token stored in Redis/DB
  | "FAILED"            // Error during callback or credential exchange
  | "LOCKED";           // Rate-limited or security lockout (MAX_ATTEMPTS reached)

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
}

/**
 * Guard Configuration Interface
 * Used by iciciGuard.ts to determine access rights for specific routes
 */
export interface IciciGuardConfig {
  /** Ensure user has completed their base profile before broker linking */
  requireProfileComplete?: boolean;
  
  /** Ensure app_key/app_secret exist in broker_credentials table */
  requireCredentials?: boolean;
  
  /** Prevent starting a new login flow if a session already exists */
  disallowIfSessionActive?: boolean;
  
  /** Allow access even if an auth flow is currently "IN_PROGRESS" (for callback) */
  allowWhileInitiated?: boolean;
}

/**
 * Helper to determine if a state requires a fresh login
 */
export const isTerminalState = (state: IciciState): boolean => {
  return ["IDLE", "FAILED", "LOCKED"].includes(state);
};
