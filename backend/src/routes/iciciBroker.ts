import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import crypto from "crypto";

import {
  createBreezeLoginSession,
} from "../utils/breezeSession.js"; // ✅ Correct Import

const router = Router();

/* ============================================================
   ENCRYPTION UTILITIES (unchanged)
============================================================ */

async function encryptData(data: string, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted + authTag.toString("base64"),
    iv: iv.toString("base64"),
  };
}

async function decryptData(encryptedData: string, iv: string, key: Buffer) {
  const ivBuffer = Buffer.from(iv, "base64");
  const encryptedBuffer = Buffer.from(encryptedData, "base64");

  const authTag = encryptedBuffer.slice(-16);
  const encrypted = encryptedBuffer.slice(0, -16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuffer);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString("base64"), "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

function getEncryptionKey(): Buffer {
  const masterSecret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!masterSecret) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY not configured");
  }

  return crypto.pbkdf2Sync(
    masterSecret,
    "alphaforge-credentials-v1",
    100000,
    32,
    "sha256"
  );
}

/* ============================================================
   STORE CREDENTIALS
============================================================ */

router.post("/store", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;

    const { broker_name, api_key, api_secret } = req.body;

    if (!broker_name || !api_key) {
      return res.status(400).json({
        error: "Missing required fields: broker_name and api_key are required",
      });
    }

    const encryptionKey = getEncryptionKey();

    const encryptedApiKey = await encryptData(api_key, encryptionKey);
    const encryptedApiSecret = api_secret
      ? await encryptData(api_secret, encryptionKey)
      : null;

    const existing = await query(
      "SELECT user_id FROM user_credentials WHERE user_id = $1 AND broker_name = $2",
      [userId, broker_name]
    );

    if (existing.rows.length > 0) {
      await query(
        `UPDATE user_credentials 
         SET icici_api_key = $1, icici_api_secret = $2, updated_at = NOW()
         WHERE user_id = $3 AND broker_name = $4`,
        [
          JSON.stringify(encryptedApiKey),
          encryptedApiSecret ? JSON.stringify(encryptedApiSecret) : null,
          userId,
          broker_name,
        ]
      );
    } else {
      await query(
        `INSERT INTO user_credentials 
         (user_id, broker_name, icici_api_key, icici_api_secret)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          broker_name,
          JSON.stringify(encryptedApiKey),
          encryptedApiSecret ? JSON.stringify(encryptedApiSecret) : null,
        ]
      );
    }

    res.json({
      success: true,
      message: "Credentials securely stored",
    });
  } catch (error) {
    next(error);
  }
});

/* ============================================================
   RETRIEVE CREDENTIALS
============================================================ */

router.post("/retrieve", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { broker_name } = req.body;

    const result = await query(
      `SELECT icici_api_key, icici_api_secret 
       FROM user_credentials 
       WHERE user_id = $1 AND broker_name = $2`,
      [userId, broker_name]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Credentials not found" });
    }

    const encryptionKey = getEncryptionKey();

    const keyData = JSON.parse(result.rows[0].icici_api_key);
    const apiKey = await decryptData(keyData.encrypted, keyData.iv, encryptionKey);

    let apiSecret = null;
    if (result.rows[0].icici_api_secret) {
      const secretData = JSON.parse(result.rows[0].icici_api_secret);
      apiSecret = await decryptData(secretData.encrypted, secretData.iv, encryptionKey);
    }

    res.json({
      api_key: apiKey,
      api_secret: apiSecret,
    });
  } catch (error) {
    next(error);
  }
});

/* ============================================================
   CONNECT TO ICICI (REAL BREEZE LOGIN CALL)
============================================================ */

router.post("/connect", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { api_key, api_secret, session_token } = req.body;

    if (!api_key || !api_secret || !session_token) {
      return res.status(400).json({
        success: false,
        error: "api_key, api_secret, and session_token required",
      });
    }

    // REAL Breeze login — generates ICICI JWT
    const jwtToken = await createBreezeLoginSession(
      userId,
      api_key,
      api_secret,
      session_token
    );

    return res.json({
      success: true,
      message: "ICICI Direct connected successfully",
      jwtToken,
    });
  } catch (err: any) {
    console.error("ICICI Connect Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to connect to ICICI",
    });
  }
});

export { router as iciciBrokerRouter };
