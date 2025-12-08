// backend/src/routes/credentials.ts
import { Router } from "express";
import crypto from "crypto";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";

const router = Router();

/**
 * Encryption format stored in DB (json string):
 * {
 *   "encrypted": "<base64 ciphertext>",
 *   "iv": "<base64 iv>",
 *   "tag": "<base64 auth tag>"
 * }
 *
 * AES-256-GCM with PBKDF2-derived 32-byte key.
 */

// ---------------------------
// Types
// ---------------------------
type EncryptedPayload = {
  encrypted: string; // base64
  iv: string;        // base64
  tag: string;       // base64
};

type StoreRequestBody = {
  broker_name?: string;
  api_key?: string;
  api_secret?: string | null;
};

// ---------------------------
// Key derivation
// ---------------------------
function getEncryptionKey(): Buffer {
  const masterSecret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!masterSecret) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY not configured");
  }

  // Derive a 32-byte key using PBKDF2 with a fixed salt (app-specific).
  // Note: salt is constant here by design for reproducible key across instances.
  return crypto.pbkdf2Sync(
    masterSecret,
    "alphaforge-credentials-v1",
    100_000,
    32,
    "sha256"
  );
}

// ---------------------------
// Encrypt / Decrypt helpers
// ---------------------------
async function encryptData(plain: string, key: Buffer): Promise<EncryptedPayload> {
  const iv = crypto.randomBytes(12); // 96-bit recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encryptedBuffers: Buffer[] = [];
  encryptedBuffers.push(cipher.update(Buffer.from(plain, "utf8")));
  encryptedBuffers.push(cipher.final());

  const encrypted = Buffer.concat(encryptedBuffers);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
  };
}

async function decryptData(payload: EncryptedPayload, key: Buffer): Promise<string> {
  const iv = Buffer.from(payload.iv, "base64");
  const encrypted = Buffer.from(payload.encrypted, "base64");
  const tag = Buffer.from(payload.tag, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const outBuffers: Buffer[] = [];
  outBuffers.push(decipher.update(encrypted));
  outBuffers.push(decipher.final());

  const decrypted = Buffer.concat(outBuffers).toString("utf8");
  return decrypted;
}

// ---------------------------
// Routes
// ---------------------------

/**
 * POST /api/credentials/store
 * Body: { broker_name, api_key, api_secret? }
 * Requires: authenticateToken (provides req.user.userId)
 */
router.post("/store", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { broker_name, api_key, api_secret } = req.body as StoreRequestBody;

    if (!broker_name || typeof broker_name !== "string" || !api_key || typeof api_key !== "string") {
      return res.status(400).json({
        error: "Missing required fields: broker_name (string) and api_key (string) are required",
      });
    }

    const key = getEncryptionKey();

    const encryptedApiKey = await encryptData(api_key, key);
    const encryptedApiSecret = api_secret ? await encryptData(api_secret, key) : null;

    // Upsert logic: check existing
    const existing = await query(
      `SELECT id FROM user_credentials WHERE user_id = $1 AND broker_name = $2`,
      [userId, broker_name]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await query(
        `UPDATE user_credentials
         SET api_key = $1, api_secret = $2, updated_at = NOW()
         WHERE user_id = $3 AND broker_name = $4
         RETURNING id`,
        [
          JSON.stringify(encryptedApiKey),
          encryptedApiSecret ? JSON.stringify(encryptedApiSecret) : null,
          userId,
          broker_name,
        ]
      );
    } else {
      result = await query(
        `INSERT INTO user_credentials (user_id, broker_name, api_key, api_secret)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          userId,
          broker_name,
          JSON.stringify(encryptedApiKey),
          encryptedApiSecret ? JSON.stringify(encryptedApiSecret) : null,
        ]
      );
    }

    return res.json({
      success: true,
      message: "Credentials securely stored",
      credential_id: result.rows[0].id,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/credentials/retrieve
 * Body: { broker_name }
 * Returns decrypted api_key and api_secret (if present)
 */
router.post("/retrieve", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { broker_name } = req.body as { broker_name?: string };

    if (!broker_name || typeof broker_name !== "string") {
      return res.status(400).json({ error: "Missing required field: broker_name" });
    }

    const result = await query(
      `SELECT api_key, api_secret, broker_name
       FROM user_credentials
       WHERE user_id = $1 AND broker_name = $2`,
      [userId, broker_name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Credentials not found" });
    }

    const credentials = result.rows[0];
    const key = getEncryptionKey();

    // Parse stored JSON (encrypted payload)
    let apiKeyPayload: EncryptedPayload;
    try {
      apiKeyPayload = JSON.parse(credentials.api_key) as EncryptedPayload;
    } catch (err) {
      return res.status(500).json({ error: "Stored api_key is corrupted" });
    }

    const decryptedApiKey = await decryptData(apiKeyPayload, key);

    let decryptedApiSecret: string | null = null;
    if (credentials.api_secret) {
      let apiSecretPayload: EncryptedPayload;
      try {
        apiSecretPayload = JSON.parse(credentials.api_secret) as EncryptedPayload;
      } catch (err) {
        return res.status(500).json({ error: "Stored api_secret is corrupted" });
      }
      decryptedApiSecret = await decryptData(apiSecretPayload, key);
    }

    return res.json({
      broker_name: credentials.broker_name,
      api_key: decryptedApiKey,
      api_secret: decryptedApiSecret,
    });
  } catch (err) {
    next(err);
  }
});

export { router as credentialsRouter };
