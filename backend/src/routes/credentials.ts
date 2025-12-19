// backend/src/routes/credentials.ts

import { Router } from "express";
import crypto from "crypto";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";

const router = Router();

/* ======================================================
   ENCRYPTION TYPES
====================================================== */
type EncryptedPayload = {
  encrypted: string;
  iv: string;
  tag: string;
};

type StoreRequestBody = {
  broker_name?: string;
  app_key?: string;
  app_secret?: string;
};

/* ======================================================
   KEY DERIVATION
====================================================== */
function getEncryptionKey(): Buffer {
  const masterSecret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!masterSecret) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY not configured");
  }

  return crypto.pbkdf2Sync(
    masterSecret,
    "alphaforge-credentials-v1",
    100_000,
    32,
    "sha256"
  );
}

/* ======================================================
   ENCRYPT / DECRYPT HELPERS
====================================================== */
async function encryptData(
  plain: string,
  key: Buffer
): Promise<EncryptedPayload> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plain, "utf8")),
    cipher.final(),
  ]);

  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

async function decryptData(
  payload: EncryptedPayload,
  key: Buffer
): Promise<string> {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encrypted, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/* ======================================================
   GET METADATA (NO SECRETS)
====================================================== */
router.get("/:broker", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const broker = req.params.broker.toUpperCase();

  const result = await query(
    `
    SELECT broker_name, is_active, last_connected, created_at
    FROM broker_credentials
    WHERE user_id = $1 AND broker_name = $2
    `,
    [userId, broker]
  );

  if (result.rowCount === 0) {
    return res.json({ connected: false });
  }

  return res.json({
    connected: true,
    ...result.rows[0],
  });
});

/* ======================================================
   STORE API CREDENTIALS (ENCRYPTED)
====================================================== */
router.post("/store", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { broker_name, app_key, app_secret } = req.body as StoreRequestBody;

    if (!broker_name || !app_key || !app_secret) {
      return res.status(400).json({
        error: "broker_name, api_key and api_secret are required",
      });
    }

    const key = getEncryptionKey();

    const encryptedApiKey = await encryptData(app_key, key);
    const encryptedApiSecret = await encryptData(app_secret, key);

    const existing = await query(
      `SELECT id FROM broker_credentials WHERE user_id = $1 AND broker_name = $2`,
      [userId, broker_name.toUpperCase()]
    );

    if ((existing.rowCount ?? 0) > 0) {
      await query(
        `
        UPDATE broker_credentials
        SET api_key = $1,
            api_secret = $2,
            updated_at = NOW()
        WHERE user_id = $3 AND broker_name = $4
        `,
        [
          JSON.stringify(encryptedApiKey),
          JSON.stringify(encryptedApiSecret),
          userId,
          broker_name.toUpperCase(),
        ]
      );
    } else {
      await query(
        `
        INSERT INTO broker_credentials
          (user_id, broker_name, app_key, app_secret, is_active)
        VALUES ($1, $2, $3, $4, true)
        `,
        [
          userId,
          broker_name.toUpperCase(),
          JSON.stringify(encryptedApiKey),
          JSON.stringify(encryptedApiSecret),
        ]
      );
    }

    return res.json({
      success: true,
      message: "Broker credentials stored securely",
    });
  } catch (err) {
    next(err);
  }
});

/* ======================================================
   RETRIEVE (DECRYPTED – AUTH ONLY)
====================================================== */
router.post("/retrieve", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { broker_name } = req.body;

    if (!broker_name) {
      return res.status(400).json({ error: "broker_name required" });
    }

    const result = await query(
      `
      SELECT app_key, app_secret
      FROM broker_credentials
      WHERE user_id = $1 AND broker_name = $2
      `,
      [userId, broker_name.toUpperCase()]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Credentials not found" });
    }

    const key = getEncryptionKey();

    const apiKeyPayload = JSON.parse(result.rows[0].api_key);
    const apiSecretPayload = JSON.parse(result.rows[0].api_secret);

    return res.json({
      broker_name,
      app_key: await decryptData(apiKeyPayload, key),
      app_secret: await decryptData(apiSecretPayload, key),
    });
  } catch (err) {
    next(err);
  }
});

export { router as credentialsRouter };
