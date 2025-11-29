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

// backend/src/utils/breezeSession.ts
//--------------------------------------------------------
//  ICICI Breeze R50 Login (NO OAuth)
//  - Uses POST /breezeapi/api/v1/login
//  - Computes checksum = SHA256(appkey + apisession + secretkey)
//  - Stores JWT token returned by ICICI
//--------------------------------------------------------

//--------------------------------------------------------
//  ICICI Breeze R50 Login (NO OAuth)
//  - Uses POST /breezeapi/api/v1/login
//  - Computes checksum = SHA256(appkey + apisession + secretkey)
//  - Stores JWT token in DB
//--------------------------------------------------------

import { query } from "../config/database.js";
import { encryptJSON, decryptJSON } from "./credentialEncryptor.js";
import { BreezeConnect } from "breezeconnect";
import debug from "debug";
import fetch from "node-fetch";
import crypto from "crypto";

const log = debug("apex:icici:breeze");

const BREEZE_LOGIN_URL =
  process.env.BREEZE_LOGIN_URL ||
  "https://api.icicidirect.com/breezeapi/api/v1/login";

const CACHE_TTL_MS = 15 * 60 * 1000;

interface BreezeLoginResponse {
  jwtToken?: string;
  expiresAt?: string | null;

  // ICICI is inconsistent → normalize later
  appkey?: string;
  appKey?: string;
  AppKey?: string;
  APPKEY?: string;

  [key: string]: any;
}

export type BreezeStoredSession = {
  jwtToken: string;
  expires_at?: string;
  raw?: any;
};

const breezeCache = new Map<
  string,
  { breeze: BreezeConnect; expiresAt: number }
>();

/**
 * 1) Create Breeze Login Session
 *    apiKey + apiSecret + apisession (NOT OAuth)
 */
export async function createBreezeLoginSession(
  userId: string,
  apiKey: string,
  apiSecret: string,
  apisession: string
): Promise<BreezeStoredSession> {
  if (!userId || !apiKey || !apiSecret || !apisession) {
    throw new Error("createBreezeLoginSession: missing parameters");
  }

  // Required by ICICI: SHA256(appkey + apisession + secretkey)
  const checksum = crypto
    .createHash("sha256")
    .update(apiKey + apisession + apiSecret)
    .digest("hex");

  let res;
  try {
    res = await fetch(BREEZE_LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Checksum": checksum,
      },
      body: JSON.stringify({
        appkey: apiKey,
        secretkey: apiSecret,
        sessionToken: apisession, // ICICI expects this field name
      }),
    });
  } catch (e: any) {
    log("Network error contacting Breeze login: %O", e);
    throw new Error("Network error contacting Breeze login: " + e.message);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    log("ICICI Breeze login response:", txt);
    throw new Error(`Breeze login failed: ${res.status} ${txt}`);
  }

  const json = (await res.json()) as BreezeLoginResponse;

  if (!json.jwtToken) {
    log("Breeze login response missing jwtToken:", json);
    throw new Error("Breeze login: missing jwtToken in response");
  }

  // Normalize appkey variations
  const normalizedAppKey =
    json.appkey ||
    json.appKey ||
    json.AppKey ||
    json.APPKEY ||
    apiKey;

  json.appkey = normalizedAppKey;

  const session: BreezeStoredSession = {
    jwtToken: json.jwtToken,
    expires_at: json.expiresAt || undefined,
    raw: json,
  };

  const encrypted = encryptJSON(session);

  await query(
    `
      INSERT INTO user_credentials (user_id, broker_name, icici_credentials, created_at, updated_at)
      VALUES ($1, 'icici', $2, NOW(), NOW())
      ON CONFLICT (user_id, broker_name)
      DO UPDATE SET icici_credentials = $2, updated_at = NOW()
    `,
    [userId, JSON.stringify(encrypted)]
  );

  invalidateBreezeInstance(userId);
  log("✔ Saved Breeze JWT for user %s", userId);

  return session;
}

/**
 * 2) Retrieve stored session
 */
export async function getSessionForUser(
  userId: string
): Promise<BreezeStoredSession | null> {
  const r = await query(
    `SELECT icici_credentials FROM user_credentials WHERE user_id = $1 AND broker_name = 'icici'`,
    [userId]
  );

  if (!r.rows.length) return null;
  if (!r.rows[0].icici_credentials) return null;

  return decryptJSON(r.rows[0].icici_credentials);
}

/**
 * 3) Clear stored session
 */
export async function clearSessionForUser(userId: string) {
  await query(
    `
      UPDATE user_credentials
      SET icici_credentials = NULL, updated_at = NOW()
      WHERE user_id = $1 AND broker_name = 'icici'
    `,
    [userId]
  );
  invalidateBreezeInstance(userId);
}

/**
 * 4) Get Breeze Instance
 */
export async function getBreezeInstance(
  userId: string
): Promise<BreezeConnect> {
  const cached = breezeCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.breeze;

  const session = await getSessionForUser(userId);
  if (!session?.jwtToken) {
    throw new Error("No Breeze JWT available for user — connect first");
  }

  const breeze = new BreezeConnect();

  try {
    if ((breeze as any).setSessionToken)
      (breeze as any).setSessionToken(session.jwtToken);

    if ((breeze as any).setApiKey && session.raw?.appkey)
      (breeze as any).setApiKey(session.raw.appkey);
  } catch (e) {
    log("Warning: BreezeConnect version mismatch: %O", e);
  }

  breezeCache.set(userId, {
    breeze,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return breeze;
}

/**
 * 5) Invalidate cached instance
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
