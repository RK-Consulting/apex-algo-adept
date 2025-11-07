// src/utils/breezeSession.ts
import { query } from "../config/database.js";
import { BreezeConnect } from "breezeconnect";

export async function getBreezeInstance(userId: string): Promise<any> {
  const creds = await query(
    `SELECT icici_api_key, icici_api_secret, icici_token 
     FROM user_credentials WHERE user_id = $1`,
    [userId]
  );

  if (creds.rows.length === 0) {
    throw new Error("ICICI credentials not found. Please log in first.");
  }

  const { icici_api_key, icici_api_secret, icici_token } = creds.rows[0];

  //const breeze = new BreezeConnect({ appKey: icici_api_key });
  //await breeze.generateSession(icici_api_secret, icici_token);
  const breeze = new BreezeConnect();
  await breeze.generateSession(icici_api_key, icici_api_secret);
  return breeze;
}
