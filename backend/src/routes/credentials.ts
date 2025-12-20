// backend/src/routes/credentials.ts

import { Router } from "express";
import crypto from "crypto";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";

const router = Router();

/* ======================================================
   TYPES
====================================================== */
type EncryptedPayload = {
  encrypted: string;
  iv: string;
  tag: string;
};

type StoreRequestBody = {
  broker_name?: string;
  req_app_key?: string;     // GUI → backend
  req_app_secret?: string; // GUI → backend
};

/* ======================================================
   KEY DERIVATION (SERVER SCOPE)
====================================================== */
function getServerEncryptionKey(): Buffer {
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
   ENCRYPT / DECRYPT (SERVER UTILS)
====================================================== */
async function encryptServerValue(
  srv_plain_value: string,
  srv_key: Buffer
): Promise<EncryptedPayload> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", srv_key, iv);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(srv_plain_value, "utf8")),
    cipher.final(),
  ]);

  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

async function decryptServerValue(
  db_payload: EncryptedPayload,
  srv_key: Buffer
): Promise<string> {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    srv_key,
    Buffer.from(db_payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(db_payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(db_payload.encrypted, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/* ======================================================
   GET METADATA (NO SECRETS)
====================================================== */
router.get("/:broker", authenticateToken, async (req: AuthRequest, res) => {
  const srv_user_id = req.user!.userId;
  const srv_broker_name = req.params.broker.toUpperCase();

  const result = await query(
    `
    SELECT broker_name, is_active, last_connected, created_at
    FROM broker_credentials
    WHERE user_id = $1 AND broker_name = $2
    `,
    [srv_user_id, srv_broker_name]
  );

  if ((result.rowCount ?? 0) === 0) {
    return res.json({ connected: false });
  }

  return res.json({
    connected: true,
    ...result.rows[0],
  });
});

/* ======================================================
   STORE API CREDENTIALS (GUI → SERVER → DB)
====================================================== */
router.post("/store", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const srv_user_id = req.user!.userId;

    const {
      broker_name,
      req_app_key,
      req_app_secret,
    } = req.body as StoreRequestBody;

    if (!broker_name || !req_app_key || !req_app_secret) {
      return res.status(400).json({
        error: "broker_name, app_key and app_secret are required",
      });
    }

    const srv_broker_name = broker_name.toUpperCase();

    // SERVER SCOPE VARIABLES
    const srv_app_key = req_app_key;
    const srv_app_secret = req_app_secret;

    const srv_crypto_key = getServerEncryptionKey();

    const db_app_key_payload = await encryptServerValue(
      srv_app_key,
      srv_crypto_key
    );
    const db_app_secret_payload = await encryptServerValue(
      srv_app_secret,
      srv_crypto_key
    );

    const existing = await query(
      `
      SELECT id
      FROM broker_credentials
      WHERE user_id = $1 AND broker_name = $2
      `,
      [srv_user_id, srv_broker_name]
    );

    if ((existing.rowCount ?? 0) > 0) {
      await query(
        `
        UPDATE broker_credentials
        SET app_key = $1,
            app_secret = $2,
            updated_at = NOW()
        WHERE user_id = $3 AND broker_name = $4
        `,
        [
          JSON.stringify(db_app_key_payload),
          JSON.stringify(db_app_secret_payload),
          srv_user_id,
          srv_broker_name,
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
          srv_user_id,
          srv_broker_name,
          JSON.stringify(db_app_key_payload),
          JSON.stringify(db_app_secret_payload),
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
    const srv_user_id = req.user!.userId;
    const { broker_name } = req.body;

    if (!broker_name) {
      return res.status(400).json({ error: "broker_name required" });
    }

    const srv_broker_name = broker_name.toUpperCase();

    const result = await query(
      `
      SELECT app_key, app_secret
      FROM broker_credentials
      WHERE user_id = $1 AND broker_name = $2
      `,
      [srv_user_id, srv_broker_name]
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ error: "Credentials not found" });
    }

    const srv_crypto_key = getServerEncryptionKey();

    const db_app_key_payload: EncryptedPayload = JSON.parse(result.rows[0].app_key);
    const db_app_secret_payload: EncryptedPayload = JSON.parse(result.rows[0].app_secret);

    const srv_app_key = await decryptServerValue(db_app_key_payload, srv_crypto_key);
    const srv_app_secret = await decryptServerValue(db_app_secret_payload, srv_crypto_key);

    return res.json({
      broker_name: srv_broker_name,
      app_key: srv_app_key,
      app_secret: srv_app_secret,
    });
  } catch (err) {
    next(err);
  }
});

export { router as credentialsRouter };
