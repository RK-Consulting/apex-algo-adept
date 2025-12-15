// backend/src/routes/iciciBroker.ts

/**
 * ICICI broker routes:
 *  - POST /api/icici/broker/store     -> store encrypted api-key/secret
 *  - POST /api/icici/broker/retrieve  -> retrieve decrypted values
 *  - POST /api/icici/broker/connect   -> start ICICI login flow
 *  - POST /api/icici/broker/complete  -> finalize after callback containing apisession
 *
 * Mounted at: app.use('/api/icici/broker', iciciBrokerRouter)
 */

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import {
  getEncryptionKey,
  encryptDataRaw,
  decryptDataRaw
} from "../utils/credentialEncryptor.js";
/*import {
  createBreezeLoginSession,
  getSessionForUser
} from "../utils/breezeSession.js"; */
import { SessionService } from '../services/sessionService';
import debug from "debug";

const log = debug("apex:icici:broker");
const router = Router(); 

/* -------------------------------------------------------
 * 1) STORE CREDENTIALS
 * -----------------------------------------------------*/
router.post("/store", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { broker_name = "icici", api_key, api_secret, username, password } =
      req.body;

    if (!api_key || !api_secret) {
      return res
        .status(400)
        .json({ error: "api_key and api_secret required" });
    }

    const payload = {
      api_key,
      api_secret,
      username: username || null,
      password: password || null
    };

    const encrypted = encryptDataRaw(payload, getEncryptionKey());

    await query(
      `
        INSERT INTO user_credentials (user_id, broker_name, icici_credentials, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (user_id, broker_name)
        DO UPDATE SET icici_credentials = $3, updated_at = NOW()
      `,
      [userId, broker_name, JSON.stringify(encrypted)]
    );

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------
 * 2) RETRIEVE DECRYPTED CREDENTIALS
 * -----------------------------------------------------*/
router.post("/retrieve", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { broker_name = "icici" } = req.body;

    const r = await query(
      `SELECT icici_credentials FROM user_credentials WHERE user_id = $1 AND broker_name = $2`,
      [userId, broker_name]
    );

    if (!r.rows.length || !r.rows[0].icici_credentials) {
      return res.status(404).json({ error: "credentials not found" });
    }

    const enc = JSON.parse(r.rows[0].icici_credentials);
    const decrypted = JSON.parse(
      decryptDataRaw(enc.encrypted, enc.iv, getEncryptionKey())
    );

    return res.json({ success: true, credentials: decrypted });
  } catch (err) {
    res.status(500).json({ error: "Failed to decrypt" });
  }
});

/* -------------------------------------------------------
 * 3) CONNECT (Frontend opens ICICI login URL)
 * -----------------------------------------------------*/
router.post("/connect", authenticateToken, async (req, res) => {
  return res.json({
    success: true,
    message:
      "Proceed to ICICI login. After callback (which sends apisession), submit it to /complete."
  });
});

/* -------------------------------------------------------
 * 4) COMPLETE — after ICICI returns ?apisession=xxxx
 * -----------------------------------------------------*/
router.post("/complete", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    // const { api_key, api_secret, apisession } = req.body;
    let { api_key, api_secret, session_token } = req.body;

    // accept apisession as alias
    if (!session_token && req.body.apisession)
      session_token = req.body.apisession;

    if (!api_key || !api_secret || !session_token) {
      return res.status(400).json({
        error: "api_key, api_secret, apisession required"
      });
    }

    // Prevent re-login if already authenticated
    const existing = await getSessionForUser(userId);
    if (existing?.jwtToken) {
      log("User %s already has Breeze JWT — skipping login", userId);
      return res.json({ success: true, jwtToken: existing.jwtToken });
    }

    log("Finalizing Breeze R50 login for user %s", userId);

    // Server-side JWT generation
    /*const session = await createBreezeLoginSession(
      userId,
      api_key,
      api_secret,
      session_token
    ); */
    const session = await SessionService.getInstance().getSession(userId);

    return res.json({
      success: true,
      jwtToken: session.jwtToken
    });
  } catch (err: any) {
    log("ICICI /complete error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "ICICI Breeze login failed"
    });
  }
});

export { router as iciciBrokerRouter };
