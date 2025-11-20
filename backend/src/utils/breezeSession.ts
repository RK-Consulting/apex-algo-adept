// backend/src/utils/breezeSession.ts
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";
import debug from "debug";

const log = debug("apex:icici:breeze");

// Cache (per user) to avoid recreating Breeze too often
const breezeCache = new Map<string, { breeze: BreezeConnect; expiresAt: number }>();

/**
 * Safely extracts session token from various Breeze SDK structures
 */
function extractSessionToken(sessionResponse: any, breeze: BreezeConnect): string {
  return (
    sessionResponse?.data?.session_token ||
    sessionResponse?.session_token ||
    (sessionResponse?.data && sessionResponse.data[0]?.session_token) ||
    (breeze as any)?.sessionToken ||
    (breeze as any)?.getSessionToken?.() ||
    ""
  );
}

/**
 * Initializes a new BreezeConnect instance with API key and session token
 */
async function initializeBreeze(
  apiKey: string,
  apiSecret: string,
  storedToken: string | null
): Promise<{ breeze: BreezeConnect; sessionToken: string }> {
  const breeze = new BreezeConnect();
  breeze.setApiKey(apiKey);

  let sessionToken = storedToken || "";

  if (sessionToken) {
    try {
      breeze.setSessionToken(sessionToken);

      // Test if stored session is valid
      try {
        await breeze.getFunds();
        log("Stored ICICI session token still valid.");
        return { breeze, sessionToken };
      } catch {
        log("Stored session invalid → regenerating.");
        sessionToken = "";
      }
    } catch {
      sessionToken = "";
    }
  }

  // No valid session stored → generate new one
  log("Generating NEW ICICI session token…");

  const sessionResponse = await breeze.generateSession(apiSecret);
  const newToken = extractSessionToken(sessionResponse, breeze);

  if (!newToken) {
    throw new Error("Failed to generate a valid ICICI session token.");
  }

  breeze.setSessionToken(newToken);
  log("Generated new session token.");

  return { breeze, sessionToken: newToken };
}

/**
 * Main exported function: returns ready-to-use authenticated BreezeConnect instance.
 */
export async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  const cached = breezeCache.get(userId);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.breeze;
  }

  // Load credentials from DB
  const { rows } = await query(
    `SELECT icici_api_key, icici_api_secret, icici_session_token
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (!rows.length) {
    throw new Error("ICICI credentials not found — user must connect ICICI account first.");
  }

  const { icici_api_key: apiKey, icici_api_secret: apiSecret, icici_session_token: storedToken } =
    rows[0];

  if (!apiKey || !apiSecret) {
    throw new Error("Missing ICICI API key or secret.");
  }

  // Initialize Breeze (reusing or regenerating session)
  const { breeze, sessionToken } = await initializeBreeze(apiKey, apiSecret, storedToken);

  // If session changed, update DB
  if (sessionToken && sessionToken !== storedToken) {
    await query(
      `UPDATE user_credentials
       SET icici_session_token = $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [sessionToken, userId]
    );
    log("Updated ICICI session token for user %s", userId);
  }

  // Cache instance for 15 min
  breezeCache.set(userId, {
    breeze,
    expiresAt: Date.now() + 15 * 60 * 1000
  });

  return breeze;
}

/**
 * Clears instance cache when user updates credentials
 */
export function invalidateBreezeInstance(userId: string) {
  breezeCache.delete(userId);
  log("Breeze cache invalidated for user %s", userId);
}
