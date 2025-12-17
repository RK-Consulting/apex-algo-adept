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
 * 1) STORE ICICI API CREDENTIALS (Encrypted)
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

  const payload = {
    api_key,
    api_secret,
    username: username || null,
    password: password || null,
  };

  const encrypted = encryptDataRaw(payload, getEncryptionKey());

  await query(
    `
    INSERT INTO icici_credentials (user_id, api_key, api_secret, extra, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      api_key = EXCLUDED.api_key,
      api_secret = EXCLUDED.api_secret,
      extra = EXCLUDED.extra,
      updated_at = NOW()
    `,
    [
      userId,
      encrypted.api_key,
      encrypted.api_secret,
      JSON.stringify({
        username: encrypted.username,
        password: encrypted.password,
      }),
    ]
  );

  log("Stored ICICI credentials for user %s", userId);

  res.json({ success: true });
});

/* -------------------------------------------------------
 * 2) RETRIEVE DECRYPTED CREDENTIALS (User-facing)
 * -----------------------------------------------------*/
router.post("/retrieve", authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  const result = await query(
    `
    SELECT api_key, api_secret, extra
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

  const decrypted = {
    api_key: decryptDataRaw(row.api_key, getEncryptionKey()),
    api_secret: decryptDataRaw(row.api_secret, getEncryptionKey()),
    ...(row.extra ? JSON.parse(decryptDataRaw(row.extra, getEncryptionKey())) : {}),
  };

  res.json({
    success: true,
    credentials: decrypted,
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
