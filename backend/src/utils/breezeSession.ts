// backend/src/utils/breezeSession.ts
//--------------------------------------------------------
//  ICICI Breeze Server-to-Server Login (OPTION 1)
//  - No OAuth
//  - Uses POST /breezeapi/api/v1/login
//  - Computes X-Checksum: SHA256(appkey + sessionToken + secretkey)
//  - Stores JWT token in DB
//--------------------------------------------------------

/**
 * ************************************************************
 *  Unified Breeze Session utilities (AlphaForge)
 *  -----------------------------------------------------------
 *  Responsibilities:
 *   - Create Breeze JWT login using API Key / Secret & sessionToken
 *   - Store encrypted Breeze JWT session in user_credentials
 *   - Provide helper to retrieve decrypted session token for a user
 *   - Provide getBreezeInstance(userId) -> BreezeConnect instance
 *
 *  Notes:
 *   - Uses AES-encryption util in credentialEncryptor.ts
 *   - Caches BreezeConnect instances per-user to avoid repeated connect()
 * ************************************************************
 */

import { query } from "../config/database.js";
import { encryptJSON, decryptJSON, getEncryptionKey } from "./credentialEncryptor.js";
import { BreezeConnect } from "breezeconnect";
import debug from "debug";
import fetch from "node-fetch";

const log = debug("apex:icici:breeze");

const BREEZE_LOGIN_URL = process.env.BREEZE_LOGIN_URL || "https://api.icicidirect.com/breezeapi/api/v1/login";
const CACHE_TTL_MS = 15 * 60 * 1000;

// Cache of BreezeConnect instances per user
const breezeCache = new Map<string, { breeze: BreezeConnect; expiresAt: number }>();

export type BreezeStoredSession = {
  jwtToken: string;
  expires_at?: string;
  refresh_token?: string;
  raw?: any;
};

/**
 * createBreezeLoginSession
 * - Called after frontend supplies apiKey, apiSecret, and sessionToken (obtained after user login on Breeze)
 * - Makes provider-specific POST (Breeze) and extracts jwtToken
 * - Stores encrypted session in user_credentials (icici_session_token JSON)
 *
 * Returns saved BreezeStoredSession.
 */
export async function createBreezeLoginSession(
  userId: string,
  apiKey: string,
  apiSecret: string,
  sessionToken: string
): Promise<BreezeStoredSession> {
  // Validate inputs
  if (!userId || !apiKey || !apiSecret || !sessionToken) {
    throw new Error("createBreezeLoginSession: missing parameters");
  }

  // Compute provider checksum header (provider-specific)
  const checksum = require("crypto").createHash("sha256").update(apiKey + sessionToken + apiSecret).digest("hex");

  const res = await fetch(BREEZE_LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Checksum": checksum,
    },
    body: JSON.stringify({
      appkey: apiKey,
      secretkey: apiSecret,
      sessionToken,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Breeze login failed: ${res.status} ${txt}`);
  }

  const json = await res.json();

  if (!json || !json.jwtToken) {
    throw new Error("Breeze login: missing jwtToken in response");
  }

  const session: BreezeStoredSession = {
    jwtToken: json.jwtToken,
    expires_at: json.expiresAt || undefined,
    raw: json,
  };

  // encrypt session and upsert into user_credentials under broker_name 'icici'
  const encrypted = encryptJSON(session);

  await query(
    `INSERT INTO user_credentials (user_id, broker_name, icici_credentials, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (user_id, broker_name)
     DO UPDATE SET icici_credentials = $3, updated_at = NOW()`,
    [userId, "icici", JSON.stringify(encrypted)]
  );

  // invalidate cached Breeze instance if exists
  invalidateBreezeInstance(userId);

  log("Saved Breeze JWT for user %s", userId);
  return session;
}

/**
 * getSessionForUser
 * - returns decrypted BreezeStoredSession or null
 */
export async function getSessionForUser(userId: string): Promise<BreezeStoredSession | null> {
  const r = await query(`SELECT icici_credentials FROM user_credentials WHERE user_id = $1 AND broker_name = $2`, [userId, "icici"]);
  if (!r.rows.length) return null;
  const payload = r.rows[0].icici_credentials;
  if (!payload) return null;
  return decryptJSON(payload);
}

/**
 * clearSessionForUser
 */
export async function clearSessionForUser(userId: string) {
  await query(`UPDATE user_credentials SET icici_credentials = NULL, updated_at = NOW() WHERE user_id = $1 AND broker_name = $2`, [userId, "icici"]);
  invalidateBreezeInstance(userId);
}

/**
 * getBreezeInstance
 * - Returns a configured BreezeConnect instance for the user
 * - Reuses cached instance for CACHE_TTL_MS
 */
export async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  const cached = breezeCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.breeze;

  const session = await getSessionForUser(userId);
  if (!session?.jwtToken) {
    throw new Error("No Breeze JWT available for user — connect first");
  }

  const breeze = new BreezeConnect();
  // BreezeConnect expects setSessionToken(jwt) / setApiKey if needed by its internals
  try {
    if ((breeze as any).setSessionToken) (breeze as any).setSessionToken(session.jwtToken);
    if ((breeze as any).setApiKey && session.raw?.appkey) (breeze as any).setApiKey(session.raw.appkey);
  } catch (e) {
    log("Warning: BreezeConnect setSessionToken/setApiKey may not exist in this version: %O", e);
  }

  breezeCache.set(userId, { breeze, expiresAt: Date.now() + CACHE_TTL_MS });
  return breeze;
}

/**
 * invalidateBreezeInstance
 */
export function invalidateBreezeInstance(userId: string) {
  breezeCache.delete(userId);
  log("Invalidated Breeze cache for user %s", userId);
}

export default {
  createBreezeLoginSession,
  getSessionForUser,
  clearSessionForUser,
  getBreezeInstance,
  invalidateBreezeInstance,
};
