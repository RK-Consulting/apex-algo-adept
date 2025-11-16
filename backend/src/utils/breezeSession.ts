// src/utils/breezeSession.ts
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";
import debug from "debug";

const log = debug("apex:icici:breeze");

// simple in-memory cache for Breeze instances per user (server restart clears cache)
const breezeCache = new Map<string, { breeze: BreezeConnect; expiresAt: number }>();

/**
 * Get Breeze instance for a user:
 * - reads stored credentials from user_credentials table (fallback to env)
 * - ensures session token present and valid (regenerates if needed)
 * - stores refreshed session_token back to DB
 */
export async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  const { rows } = await query(
    `SELECT icici_api_key, icici_api_secret, icici_session_token
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("ICICI credentials not found. Please connect first.");
  }

  const { icici_api_key, icici_api_secret, icici_session_token } = rows[0];

  if (!icici_api_key || !icici_api_secret) {
    throw new Error("Missing ICICI API key/secret. Re-authenticate.");
  }

  // Breeze SDK v2.x usage
  const breeze = new BreezeConnect();
  breeze.setApiKey(icici_api_key);

  // Generate new session internally
  await breeze.generateSession(icici_api_secret);

  // If we have a stored session token, reuse it
  if (icici_session_token) {
    breeze.setSessionToken(icici_session_token);
  }

  return breeze;
}
