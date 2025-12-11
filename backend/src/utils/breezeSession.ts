// backend/src/utils/breezeSession.ts
/**
 * Unified Breeze Session utilities (AlphaForge) - TypeScript
 *
 * Responsibilities:
 *  - Create Breeze JWT login using API Key / Secret & apisession (server-to-server login)
 *  - Store encrypted Breeze JWT session in user_credentials.icici_credentials
 *  - Provide helper to retrieve decrypted session token for a user
 *  - Provide getBreezeInstance(userId) -> BreezeConnect instance (cached in Redis)
 *
 * Notes:
 *  - Uses AES-encryption util in credentialEncryptor.ts (encryptJSON / decryptJSON)
 *  - Uses axios for HTTP with retries
 *  - Checksum computed as SHA256( timestamp + JSONPostData + secret_key )
 *  - X-Timestamp header set to YYYY-MM-DDTHH:MM:SS.000Z (UTC)
 *  - Cache in Redis for scalability across instances
 */

import axios from "axios";
import axiosRetry from "axios-retry";
import crypto from "crypto";
import debug from "debug";
import redis from "../config/redis.js";
import { query } from "../config/database.js";
import { encryptJSON, decryptJSON } from "./credentialEncryptor.js";
import { BreezeConnect } from "breezeconnect";

const log = debug("apex:icici:breeze");

const BREEZE_LOGIN_URL =
  process.env.BREEZE_LOGIN_URL ||
  "https://api.icicidirect.com/breezeapi/api/v1/login";

const CACHE_TTL_SEC = Number(process.env.BREEZE_INSTANCE_TTL_SEC || 900); // 15 min

export type BreezeStoredSession = {
  jwtToken: string;
  expires_at?: string | null;
  raw?: any;
};

// Configure axios retries for reliability
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return error.response?.status === 429 || error.response?.status >= 500;
  },
});

/** ISO timestamp in required format YYYY-MM-DDTHH:MM:SS.000Z */
function isoTimestamp(): string {
  const iso = new Date().toISOString();
  return iso.slice(0, 19) + ".000Z";
}

/**
 * Official checksum format (per Breeze docs):
 * SHA256( timestamp + JSONPostData + secret_key )
 * NOTE: JSONPostData must be compact (no spaces)
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

  // FIX from PDF: Exact field names
  const bodyObj = {
    app_key: apiKey.trim(),
    secret_key: secretKey.trim(),
    session_token: apisession.trim(),
  };

  const bodyStr = JSON.stringify(bodyObj); // Compact JSON
  const timestamp = isoTimestamp();
  const checksum = computeChecksum(timestamp, bodyStr, secretKey.trim());

  // Perform HTTP POST with retries
  let resp;
  try {
    resp = await axios.post(BREEZE_LOGIN_URL, bodyObj, {
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Checksum": "checksum " + checksum, // FIX: "checksum <value>"
        "X-AppKey": apiKey.trim(),
      },
      timeout: 15000,
    });
  } catch (err: any) {
    log("Breeze login error: %O", err?.response?.data ?? err?.message);
    throw new Error("Breeze login failed: " + (err?.response?.data?.Error || err?.message));
  }

  const json = resp.data as any;

  const jwtToken =
    json.jwtToken ||
    json.jwt_token ||
    json.token ||
    json.access_token;

  if (!jwtToken) {
    throw new Error("Breeze login: missing jwt token in response");
  }

  const stored: BreezeStoredSession = {
    jwtToken,
    expires_at: json.expiresAt || json.expires_at || null,
    raw: { ...json, app_key: apiKey.trim() },
  };

  // Encrypt and store in DB
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

  // Invalidate cache
  await invalidateBreezeInstance(userId);

  log("Created Breeze session for user %s", userId);
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
    return decryptJSON(storedJson) as BreezeStoredSession;
  } catch (err) {
    log("Decrypt failed for user %s: %O", userId, err);
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
  await invalidateBreezeInstance(userId);
}

/**
 * Return a BreezeConnect instance initialized with stored JWT
 * Caches in Redis for scalability (key: breeze:user:<userId>)
 */
export async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  const cacheKey = `breeze:user:${userId}`;
  const cachedStr = await redis.get(cacheKey);

  if (cachedStr) {
    try {
      const cached = JSON.parse(cachedStr);
      const breeze = new BreezeConnect();
      // Rehydrate instance (BreezeConnect is stateful)
      breeze.setSessionToken(cached.jwtToken); // Assuming setSessionToken method
      return breeze;
    } catch (err) {
      log("Redis cache parse error for %s: %O", userId, err);
    }
  }

  const session = await getSessionForUser(userId);
  if (!session?.jwtToken) {
    throw new Error("No Breeze JWT — connect first");
  }

  const breeze = new BreezeConnect();

  // Set token (handle different SDK versions)
  const setters = ["setSessionToken", "setJwtToken", "setAccessToken"];
  let set = false;
  for (const method of setters) {
    if (typeof (breeze as any)[method] === "function") {
      (breeze as any)[method](session.jwtToken);
      set = true;
      break;
    }
  }
  if (!set) {
    throw new Error("BreezeConnect SDK missing token setter method");
  }

  const appkey = session.raw?.app_key || process.env.ICICI_APP_KEY;
  if (appkey && typeof (breeze as any).setApiKey === "function") {
    (breeze as any).setApiKey(appkey);
  }

  // Cache in Redis
  await redis.set(cacheKey, JSON.stringify({ jwtToken: session.jwtToken }), "EX", CACHE_TTL_SEC);

  return breeze;
}

/** Invalidate cached BreezeConnect instance */
export async function invalidateBreezeInstance(userId: string) {
  const cacheKey = `breeze:user:${userId}`;
  await redis.del(cacheKey);
  log("Invalidated Breeze cache for %s", userId);
}

export default {
  createBreezeLoginSession,
  getSessionForUser,
  clearSessionForUser,
  getBreezeInstance,
  invalidateBreezeInstance,
};
