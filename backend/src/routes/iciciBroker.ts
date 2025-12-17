// backend/src/routes/iciciBroker.ts
/**
 * ICICI Broker Routes — Refactored for New Architecture
 *
 * Responsibilities:
 * - Store encrypted ICICI API credentials
 * - Retrieve decrypted credentials (user-facing only)
 * - Initiate ICICI OAuth login
 *
 * Notes:
 * - Session creation is handled ONLY via authCallback (/api/icici/auth/*)
 * - No session_token or apisession handled here
 * - No Breeze JWT / SDK usage
 */
// backend/src/routes/iciciBroker.ts

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import {
  getEncryptionKey,
  encryptDataRaw,
  decryptDataRaw,
} from "../utils/credentialEncryptor.js";
import debug from "debug";

const router = Router();
const log = debug("alphaforge:icici:broker");

/* -------------------------------------------------------
 * 1) STORE ICICI API CREDENTIALS (Encrypted as ONE blob)
 * -----------------------------------------------------*/
router.post("/store", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { api_key, api_secret, username, password } = req.body;

  if (!api_key || !api_secret) {
    return res.status(400).json({
      success: false,
      error: "api_key and api_secret required",
    });
  }

  // Encrypt full payload as ONE unit
  const encrypted = encryptDataRaw(
    JSON.stringify({
      api_key,
      api_secret,
      username: username || null,
      password: password || null,
    }),
    getEncryptionKey()
  );

  await query(
    `
    INSERT INTO icici_credentials (user_id, encrypted_blob, iv, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      encrypted_blob = EXCLUDED.encrypted_blob,
      iv = EXCLUDED.iv,
      updated_at = NOW()
    `,
    [userId, encrypted.encrypted, encrypted.iv]
  );

  log("Stored ICICI credentials for user %s", userId);

  res.json({ success: true });
});

/* -------------------------------------------------------
 * 2) RETRIEVE DECRYPTED CREDENTIALS
 * -----------------------------------------------------*/
router.post("/retrieve", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  const result = await query(
    `
    SELECT encrypted_blob, iv
    FROM icici_credentials
    WHERE user_id = $1
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      error: "credentials not found",
    });
  }

  const row = result.rows[0];

  // Convert Buffer → string before decrypt
  const decryptedJson = decryptDataRaw(
    row.encrypted_blob.toString(),
    row.iv.toString(),
    getEncryptionKey()
  );

  const credentials = JSON.parse(decryptedJson);

  res.json({
    success: true,
    credentials,
  });
});

/* -------------------------------------------------------
 * 3) CONNECT — frontend initiates OAuth login
 * -----------------------------------------------------*/
router.post("/connect", authenticateToken, async (_req, res) => {
  res.json({
    success: true,
    message: "Proceed to ICICI login via /api/icici/auth/login",
  });
});

export { router as iciciBrokerRouter };

