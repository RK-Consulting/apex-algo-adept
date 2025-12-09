// backend/src/utils/breezeSession.ts
/**
 * Unified Breeze Session utilities (AlphaForge) - TypeScript
 *
 * Responsibilities:
 *  - Create Breeze JWT login using API Key / Secret & apisession (server-to-server login)
 *  - Store encrypted Breeze JWT session in user_credentials.icici_credentials
 *  - Provide helper to retrieve decrypted session token for a user
 *  - Provide getBreezeInstance(userId) -> BreezeConnect instance (cached)
 *
 * Notes:
 *  - Uses AES-encryption util in credentialEncryptor.ts   (encryptJSON / decryptJSON)
 *  - Uses axios for HTTP to avoid node-fetch ESM issues
 *  - Checksum computed as SHA256( timestamp + JSONPostData + secret_key )
 *  - X-Timestamp header set to YYYY-MM-DDTHH:MM:SS.000Z (UTC)
 */

import axios from "axios";
import crypto from "crypto";
import debug from "debug";
import { query } from "../config/database.js";
import { encryptJSON, decryptJSON } from "./credentialEncryptor.js";
import { BreezeConnect } from "breezeconnect";

const log = debug("apex:icici:breeze");

const BREEZE_LOGIN_URL =
  process.env.BREEZE_LOGIN_URL ||
  "https://api.icicidirect.com/breezeapi/api/v1/login";

const CACHE_TTL_MS = Number(process.env.BREEZE_INSTANCE_TTL_MS || 15 * 60 * 1000);

export type BreezeStoredSession = {
  jwtToken: string;
  expires_at?: string | null;
  raw?: any;
};

const breezeCache = new Map<
  string,
  { breeze: BreezeConnect; expiresAt: number }
>();

/** ISO timestamp in required format YYYY-MM-DDTHH:MM:SS.000Z */
function isoTimestamp(): string {
  const iso = new Date().toISOString();
  return iso.slice(0, 19) + ".000Z";
}

/**
 * Official checksum format (per Breeze docs):
 * SHA256( timestamp + JSONPostData + secret_key )
 * NOTE: JSONPostData must be stringified exactly as sent.
 */
function computeChecksum(timestamp: string, jsonBodyString: string, secretKey: string) {
  const raw = timestamp + jsonBodyString + secretKey;
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Create Breeze Login Session (server-to-server)
 *
 * - apiKey: AppKey from Breeze portal (public id)
 * - secretKey: secret_key (backend-only)
 * - apisession: the short session value returned by ICICI redirect (API_Session)
 *
 * The request must include X-Timestamp and X-Checksum computed as above.
 */
export async function createBreezeLoginSession(
  userId: string,
  apiKey: string,
  secretKey: string,
  apisession: string
): Promise<BreezeStoredSession> {
  if (!userId || !apiKey || !secretKey || !apisession) {
    throw new Error("createBreezeLoginSession: missing parameters");
  }

  // ---------------------------------------------------------------------
  // FIX 1: Breeze requires exact field names app_key, secret_key, session_token
  // ---------------------------------------------------------------------
  const bodyObj = {
    app_key: apiKey.trim(),
    secret_key: secretKey.trim(),
    session_token: apisession.trim(),
  };

  const bodyStr = JSON.stringify(bodyObj);
  const timestamp = isoTimestamp();
  const checksum = computeChecksum(timestamp, bodyStr, secretKey.trim());

  // Perform HTTP POST
  let resp;
  try {
    resp = await axios.post(BREEZE_LOGIN_URL, bodyObj, {
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,

        // ---------------------------------------------------------------------
        // FIX 2: X-Checksum must be: "checksum <value>" not "token <value>"
        // ---------------------------------------------------------------------
        "X-Checksum": "checksum " + checksum,

        "X-AppKey": apiKey.trim(),
      },
      timeout: 15000,
    });
  } catch (err: any) {
    log("Network / HTTP error contacting Breeze login: %O", err?.response?.data ?? err?.message ?? err);
    throw new Error("Network error contacting Breeze login: " + (err?.message || "unknown"));
  }

  if (!(resp && resp.status >= 200 && resp.status < 300)) {
    log("Breeze login HTTP failure: %s %O", resp?.status, resp?.data);
    throw new Error(`Breeze login failed: ${resp?.status} ${JSON.stringify(resp?.data)}`);
  }

  const json = resp.data as any;

  // Response must include a JWT token (naming may vary)
  const jwtToken =
    json.jwtToken ||
    json.jwt_token ||
    json.token ||
    json.access_token;

  if (!jwtToken) {
    log("Breeze login response missing jwt token: %O", json);
    throw new Error("Breeze login: missing jwt token in response");
  }

  // ---------------------------------------------------------------------
  // FIX 3: Preserve app_key so getBreezeInstance can rehydrate correctly
  // ---------------------------------------------------------------------
  const stored: BreezeStoredSession = {
    jwtToken,
    expires_at: json.expiresAt || json.expires_at || null,
    raw: { ...json, app_key: apiKey.trim() },
  };

  // Store encrypted in user_credentials.icici_credentials JSON column
  const encrypted = encryptJSON(stored);

  await query(
    `
    INSERT INTO user_credentials (user_id, broker_name, icici_credentials, created_at, updated_at)
    VALUES ($1, 'icici', $2, NOW(), NOW())
    ON CONFLICT (user_id, broker_name)
    DO UPDATE SET icici_credentials = $2, updated_at = NOW()
    `,
    [userId, JSON.stringify(encrypted)]
  );

  // Invalidate cache for user so new Breeze instance uses new JWT
  invalidateBreezeInstance(userId);

  log("✔ Saved Breeze JWT for user %s", userId);
  return stored;
}

/** Retrieve stored Breeze session for a user (decrypted) */
export async function getSessionForUser(userId: string): Promise<BreezeStoredSession | null> {
  const r = await query(
    `SELECT icici_credentials FROM user_credentials WHERE user_id = $1 AND broker_name = 'icici'`,
    [userId]
  );

  if (!r.rows.length) return null;
  const storedJson = r.rows[0].icici_credentials;
  if (!storedJson) return null;

  try {
    const decrypted = decryptJSON(storedJson) as BreezeStoredSession;
    return decrypted;
  } catch (err) {
    log("Failed to decrypt stored Breeze credentials for user %s: %O", userId, err);
    return null;
  }
}

/** Clear stored session (logout) */
export async function clearSessionForUser(userId: string) {
  await query(
    `UPDATE user_credentials
     SET icici_credentials = NULL, updated_at = NOW()
     WHERE user_id = $1 AND broker_name = 'icici'`,
    [userId]
  );
  invalidateBreezeInstance(userId);
}

/**
 * Return a BreezeConnect instance initialized with stored JWT
 * Caches instances per-user for short TTL (CACHE_TTL_MS)
 */
export async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  const cached = breezeCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.breeze;
  }

  const session = await getSessionForUser(userId);
  if (!session?.jwtToken) {
    throw new Error("No Breeze JWT available for user — user must connect first");
  }

  const breeze = new BreezeConnect();

  try {
    // FIX 4: Support multiple Breeze SDK versions
    if (typeof (breeze as any).setSessionToken === "function") {
      (breeze as any).setSessionToken(session.jwtToken);
    } else if (typeof (breeze as any).setJwtToken === "function") {
      (breeze as any).setJwtToken(session.jwtToken);
    } else if (typeof (breeze as any).setAccessToken === "function") {
      (breeze as any).setAccessToken(session.jwtToken);
    }

    const appkey =
      session.raw?.app_key ||
      session.raw?.appKey ||
      process.env.ICICI_APP_KEY;

    if (appkey && typeof (breeze as any).setApiKey === "function") {
      (breeze as any).setApiKey(appkey);
    }
  } catch (err) {
    log("Warning: BreezeConnect instance init - version mismatch or missing setters: %O", err);
  }

  breezeCache.set(userId, {
    breeze,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return breeze;
}

/** Invalidate cached BreezeConnect instance */
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
