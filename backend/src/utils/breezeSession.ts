// backend/src/utils/breezeSession.ts
//--------------------------------------------------------
//  ICICI Breeze Server-to-Server Login (OPTION 1)
//  - No OAuth
//  - Uses POST /breezeapi/api/v1/login
//  - Computes X-Checksum: SHA256(appkey + sessionToken + secretkey)
//  - Stores JWT token in DB
//--------------------------------------------------------

import crypto from "crypto";
import fetch from "node-fetch";
import { query } from "../config/database.js";
import { encryptObject, decryptObject } from "./credentialEncryptor.js";

const BREEZE_LOGIN_URL =
  "https://api.icicidirect.com/breezeapi/api/v1/login_user";

// DB storage broker key
const BROKER_NAME = "icici-breeze";

//-------------------------------------------------------------
// 1) MAIN LOGIN: API Key + Secret + Session Token → JWT Token
//-------------------------------------------------------------
export async function createBreezeLoginSession(
  userId: string,
  apiKey: string,
  apiSecret: string,
  sessionToken: string
) {
  // -------------------------
  // Compute ICICI-required checksum
  // -------------------------
  const checksum = crypto
    .createHash("sha256")
    .update(apiKey + sessionToken + apiSecret)
    .digest("hex");

  const payload = {
    appkey: apiKey,
    secretkey: apiSecret,
    sessionToken,
  };

  const res = await fetch(BREEZE_LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Checksum": checksum,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`ICICI Login failed (${res.status}): ${txt}`);
  }

  const json = await res.json();

  if (!json?.status || !json?.jwtToken) {
    throw new Error("ICICI responded without jwtToken");
  }

  //---------------------------------------------------------
  // Store JWT token securely (encrypted)
  //---------------------------------------------------------
  const encrypted = encryptObject({
    jwtToken: json.jwtToken,
    created_at: new Date().toISOString(),
  });

  await query(
    `INSERT INTO user_credentials (user_id, broker_name, icici_session_token, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, broker_name)
     DO UPDATE SET icici_session_token=$3, updated_at=NOW()`,
    [userId, BROKER_NAME, JSON.stringify(encrypted)]
  );

  return json.jwtToken;
}

//-------------------------------------------------------------
// 2) Retrieve Stored Session Token
//-------------------------------------------------------------
export async function getSessionForUser(
  userId: string
): Promise<{ jwtToken: string } | null> {
  const result = await query(
    `SELECT icici_session_token FROM user_credentials
     WHERE user_id=$1 AND broker_name=$2`,
    [userId, BROKER_NAME]
  );

  if (!result.rows.length) return null;
  if (!result.rows[0].icici_session_token) return null;

  const payload = JSON.parse(result.rows[0].icici_session_token);
  return decryptObject(payload);
}

//-------------------------------------------------------------
// 3) Clear Session Token (Logout)
//-------------------------------------------------------------
export async function clearSessionForUser(userId: string) {
  await query(
    `UPDATE user_credentials
     SET icici_session_token=NULL, updated_at=NOW()
     WHERE user_id=$1 AND broker_name=$2`,
    [userId, BROKER_NAME]
  );
}

export default {
  createBreezeLoginSession,
  getSessionForUser,
  clearSessionForUser,
};
