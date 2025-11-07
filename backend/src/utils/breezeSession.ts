// src/utils/breezeSession.ts
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";

export async function getBreezeInstance(userId: string): Promise<BreezeConnect> {
  const { rows } = await query(
    `SELECT icici_api_key, icici_api_secret, icici_token
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error("ICICI credentials not found. Please log in first.");
  }

  const { icici_api_key, icici_api_secret, icici_token } = rows[0];

  if (!icici_api_key || !icici_api_secret) {
    throw new Error("Missing API key or secret. Please re-authenticate.");
  }

  const breeze = new BreezeConnect();
  breeze.setApiKey(icici_api_key);                    // Set appKey
  await breeze.generateSession(icici_api_secret);     // Only 1 arg: secret

  // Optional: use cached session token if available
  if (icici_token) {
    breeze.setSessionToken(icici_token);
  }

  return breeze;
}
