// backend/src/utils/breezeSession.ts
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";
import debug from "debug";

const log = debug("apex:icici:breeze");

// Cache to avoid re-initializing Breeze repeatedly
const breezeCache = new Map<string, { breeze: BreezeConnect; expiresAt: number }>();

/**
 * getBreezeInstance(userId)
 * - Loads user ICICI credentials
 * - Reuses cached Breeze instance where possible
 * - Reuses valid session token
 * - Regenerates session only when forced or expired
 * - Saves refreshed token back to DB
 */
export async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  // 1. RETURN CACHED
  const cached = breezeCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.breeze;
  }

  // 2. LOAD USER CREDENTIALS
  const { rows } = await query(
    `SELECT icici_api_key, icici_api_secret, icici_session_token, refresh_token
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("ICICI credentials not found. Please connect your ICICI account first.");
  }

  const {
    icici_api_key: apiKey,
    icici_api_secret: apiSecret,
    icici_session_token: storedSessionToken,
    refresh_token: storedRefreshToken
  } = rows[0];

  if (!apiKey || !apiSecret) {
    throw new Error("Missing ICICI API key/secret.");
  }

  // 3. INITIALIZE BREEZECONNECT
  const breeze = new BreezeConnect();
  breeze.setApiKey(apiKey);

  let sessionToken = storedSessionToken || "";

  // 4. APPLY STORED SESSION TOKEN IF EXISTS
  if (sessionToken) {
    try {
      breeze.setSessionToken(sessionToken);

      // Optionally test validity (light API call)
      try {
        // Some Breeze versions have getProfile()
        await breeze.getFunds(); // lightweight enough to test
      } catch (err) {
        log("Stored token invalid for user %s — regenerating.", userId);
        sessionToken = "";
      }
    } catch (err) {
      sessionToken = "";
    }
  }

  // 5. REGENERATE SESSION TOKEN IF NONE OR INVALID
  if (!sessionToken) {
    log("Generating new session token for user %s", userId);

    const sessionResponse = await breeze.generateSession(apiSecret);

    // Different Breeze versions return token differently:
    const newToken =
      (sessionResponse?.data?.session_token) ||
      (sessionResponse?.session_token) ||
      (breeze as any).sessionToken ||
      (breeze as any).getSessionToken?.() ||
      "";

    if (!newToken) {
      throw new Error("Failed to generate ICICI session token.");
    }

    sessionToken = newToken;
    breeze.setSessionToken(sessionToken);

    // Save updated token
    await query(
      `UPDATE user_credentials
       SET icici_session_token = $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [sessionToken, userId]
    );

    log("Updated ICICI session token in DB for user %s", userId);
  }

  // 6. CACHE INSTANCE FOR 15 MINUTES
  breezeCache.set(userId, {
    breeze,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  return breeze;
}

/**
 * Clears cache after user updates ICICI credentials
 */
export function invalidateBreezeInstance(userId: string) {
  breezeCache.delete(userId);
  log("Invalidated Breeze cache for user %s", userId);
}
