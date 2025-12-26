// backend/src/types/icici.ts
export type IciciState =
  | "NONE"
  | "CREDENTIALS_SAVED"
  | "AUTH_IN_PROGRESS"
  | "SESSION_ACTIVE"
  | "SESSION_EXPIRED"
  | "LOCKED";

export interface IciciGuardMode {
  requireProfileComplete?: boolean;
  requireCredentials?: boolean;
  disallowIfSessionActive?: boolean;
}
