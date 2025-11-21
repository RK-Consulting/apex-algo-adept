// backend/src/utils/breezeSession.ts
import crypto from "crypto";
import { query } from "../config/database.js";
import { promisify } from "util";
import { URLSearchParams } from "url";
import type { IncomingMessage } from "http";

const pbkdf2 = promisify(crypto.pbkdf2);

type BreezeSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: string; // ISO
  scope?: string;
  token_type?: string;
  raw?: any;
};

const ICICI_AUTH_BASE = process.env.ICICI_BREEZE_AUTH_BASE || "https://breeze.icicidirect.com"; // TODO: replace with real
const CLIENT_ID = process.env.ICICI_BREEZE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.ICICI_BREEZE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.ICICI_BREEZE_REDIRECT_URI || `${process.env.BACKEND_PUBLIC_URL}/api/icici/auth/callback`;
const CREDENTIALS_ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY;

if (!CREDENTIALS_ENCRYPTION_KEY) throw new Error("CREDENTIALS_ENCRYPTION_KEY not configured");

async function getEncryptionKey(): Promise<Buffer> {
  // PBKDF2 to derive a 32 byte key
  return crypto.pbkdf2Sync(CREDENTIALS_ENCRYPTION_KEY!, "alphaforge-credentials-v1", 100000, 32, "sha256");
}

function encryptJson(obj: any) {
  const key = crypto.createHash("sha256").update(CREDENTIALS_ENCRYPTION_KEY!).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const str = JSON.stringify(obj);
  const enc = Buffer.concat([cipher.update(str, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([enc, tag]).toString("base64");
  return { iv: iv.toString("base64"), encrypted: payload };
}

function decryptJson(payloadObj: { iv: string; encrypted: string }) {
  const key = crypto.createHash("sha256").update(CREDENTIALS_ENCRYPTION_KEY!).digest();
  const iv = Buffer.from(payloadObj.iv, "base64");
  const buffer = Buffer.from(payloadObj.encrypted, "base64");
  // last 16 bytes = tag
  const tag = buffer.slice(-16);
  const enc = buffer.slice(0, -16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  return JSON.parse(out);
}

/**
 * buildBreezeLoginUrl
 * Returns the URL the frontend should open so user can login to ICICI Breeze (OAuth flow)
 */
export async function createBreezeLoginSession(userId: string) {
  // NOTE: provider-specific params vary. Adjust `scope`, `state` as needed.
  const state = `${userId}:${crypto.randomBytes(8).toString("hex")}`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid profile", // TODO: adjust
    state,
  });

  // If provider supports a session creation endpoint, you could call it here.
  const loginUrl = `${ICICI_AUTH_BASE}/oauth/authorize?${params.toString()}`;
  // Save state mapping to DB to validate callback (optional)
  await query(
    `INSERT INTO icici_oauth_states (user_id, state, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (state) DO NOTHING`,
    [userId, state]
  ).catch(() => { /* ignore if table missing */ });

  return { loginUrl, state };
}

/**
 * handleAuthCallback
 * Exchange code -> tokens, store encrypted tokens into user_credentials.
 */
export async function handleAuthCallback(userId: string, code: string) {
  // Exchange authorization code for tokens
  const tokenEndpoint = `${ICICI_AUTH_BASE}/oauth/token`; // TODO confirm path
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    throw new Error(`Token exchange failed: ${tokenRes.status} ${text}`);
  }

  const tokenJson = await tokenRes.json();
  const session: BreezeSession = {
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    expires_at: tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString() : undefined,
    raw: tokenJson,
  };

  const encrypted = encryptJson(session);

  // Upsert into user_credentials table. We assume there is broker_name 'icici-breeze'
  await query(
    `INSERT INTO user_credentials (user_id, broker_name, icici_session_token, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (user_id, broker_name)
     DO UPDATE SET icici_session_token = $3, updated_at = NOW()`,
    [userId, "icici-breeze", JSON.stringify(encrypted)]
  );

  return session;
}

/**
 * getSessionForUser
 * Returns decrypted Breeze session object or null
 */
export async function getSessionForUser(userId: string): Promise<BreezeSession | null> {
  const result = await query(`SELECT icici_session_token FROM user_credentials WHERE user_id = $1 AND broker_name = $2`, [userId, "icici-breeze"]);
  if (!result.rows.length) return null;
  const row = result.rows[0];
  if (!row.icici_session_token) return null;
  const payload = JSON.parse(row.icici_session_token);
  const session = decryptJson(payload);
  return session;
}

/**
 * refreshSessionForUser
 * Uses refresh_token to obtain new tokens, stores back.
 */
export async function refreshSessionForUser(userId: string): Promise<BreezeSession> {
  const session = await getSessionForUser(userId);
  if (!session?.refresh_token) throw new Error("No refresh token for user");

  const tokenEndpoint = `${ICICI_AUTH_BASE}/oauth/token`; // TODO confirm path
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refresh_token!,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text().catch(() => "");
    throw new Error(`Refresh failed: ${tokenRes.status} ${txt}`);
  }

  const tokenJson = await tokenRes.json();
  const newSess: BreezeSession = {
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token || session.refresh_token,
    expires_at: tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString() : undefined,
    raw: tokenJson,
  };

  const encrypted = encryptJson(newSess);
  await query(`UPDATE user_credentials SET icici_session_token = $1, updated_at = NOW() WHERE user_id = $2 AND broker_name = $3`, [
    JSON.stringify(encrypted),
    userId,
    "icici-breeze",
  ]);

  return newSess;
}

/**
 * clearSessionForUser
 */
export async function clearSessionForUser(userId: string) {
  await query(`UPDATE user_credentials SET icici_session_token = NULL, updated_at = NOW() WHERE user_id = $1 AND broker_name = $2`, [userId, "icici-breeze"]);
}

export default {
  createBreezeLoginSession,
  handleAuthCallback,
  getSessionForUser,
  refreshSessionForUser,
  clearSessionForUser,
};
