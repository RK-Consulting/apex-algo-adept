// backend/src/routes/iciciBroker.ts
/**
 * ICICI broker routes:
 *  - POST /api/icici/broker/store     -> store encrypted api-key/secret and (optionally) username/password
 *  - POST /api/icici/broker/retrieve  -> retrieve decrypted values
 *  - POST /api/icici/broker/connect   -> (frontend opens ICICI login url externally) -> returns nothing heavy
 *  - POST /api/icici/broker/complete  -> frontend sends sessionToken -> this calls Breeze login and stores jwt
 *
 * Mount at: app.use('/api/icici/broker', iciciBrokerRouter)
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import { getEncryptionKey, encryptDataRaw, decryptDataRaw } from "../utils/credentialEncryptor.js";
import { createBreezeLoginSession } from "../utils/breezeSession.js";
import debug from "debug";

const log = debug("apex:icici:broker");
const router = Router();

/**
 * STORE credentials (api_key, api_secret, username, password)
 * We store sensitive pieces encrypted in icici_credentials JSON blob.
 */
router.post("/store", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { broker_name = "icici", api_key, api_secret, username, password } = req.body;

    if (!api_key || !api_secret) {
      return res.status(400).json({ error: "api_key and api_secret required" });
    }

    const payload = { api_key, api_secret, username: username || null, password: password || null };
    const encrypted = encryptDataRaw(payload, getEncryptionKey());

    await query(
      `INSERT INTO user_credentials (user_id, broker_name, icici_credentials, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id, broker_name)
       DO UPDATE SET icici_credentials = $3, updated_at = NOW()`,
      [userId, broker_name, JSON.stringify(encrypted)]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * RETRIEVE decrypted credentials
 */
router.post("/retrieve", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { broker_name = "icici" } = req.body;

    const r = await query(`SELECT icici_credentials FROM user_credentials WHERE user_id = $1 AND broker_name = $2`, [userId, broker_name]);
    if (!r.rows.length || !r.rows[0].icici_credentials) {
      return res.status(404).json({ error: "credentials not found" });
    }

    const payload = JSON.parse(r.rows[0].icici_credentials);
    const decrypted = JSON.parse(decryptDataRaw(payload.encrypted, payload.iv, getEncryptionKey()));
    // do not send password in plain in production unless necessary — but we return it for completeness per your workflow
    res.json({ success: true, credentials: decrypted });
  } catch (err) {
    next(err);
  }
});

/**
 * CONNECT (frontend will open Breeze login url using user-provided api_key & api_secret)
 *
 * Here we return the front-end login URL pattern if needed. For Breeze JWT flow,
 * the frontend will open the ICICI login page (using ICICI UI) to get the sessionToken.
 *
 * We support two modes:
 *  1) Frontend provided api_key/api_secret -> call createBreezeLoginSession immediately with sessionToken (complete)
 *  2) Frontend wants only a loginUrl -> backend returns helper info (not strictly required for this provider).
 */
router.post("/connect", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    // For this flow, client collects apiKey/apiSecret/sessionToken and sends to /complete
    res.json({ success: true, message: "Use /complete to finalize with sessionToken" });
  } catch (err) {
    next(err);
  }
});

/**
 * COMPLETE
 * - Called by frontend after user has completed login on ICICI UI and extracted sessionToken from browser URL.
 * - This endpoint performs server-side Breeze login (checksum + POST)
 * - Saves returned jwtToken encrypted into user_credentials.icici_credentials (in same blob)
 */
router.post("/complete", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { api_key, api_secret, session_token } = req.body;

    if (!api_key || !api_secret || !session_token) {
      return res.status(400).json({ error: "api_key, api_secret, session_token required" });
    }

    // Perform Breeze login & persist
    const session = await createBreezeLoginSession(userId, api_key, api_secret, session_token);

    return res.json({ success: true, jwtToken: session.jwtToken });
  } catch (err) {
    next(err);
  }
});

export { router as iciciBrokerRouter };
