// backend/src/routes/iciciBroker.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { query } from "../config/database.js";
import {
  encryptData,
  decryptData,
  getEncryptionKey,
} from "../utils/credentialEncryptor.js";
import {
  createBreezeLoginSession,
} from "../utils/breezeSession.js";

const router = Router();
const BROKER = "icici-breeze";

/* ============================================================
   STORE CREDENTIALS (API Key, Secret, Username, Password)
============================================================ */
router.post("/store", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const {
      api_key,
      api_secret,
      username,
      password,
    } = req.body;

    if (!api_key || !api_secret || !username || !password) {
      return res.status(400).json({
        error: "api_key, api_secret, username, password are required",
      });
    }

    const key = getEncryptionKey();

    const encApiKey = encryptData(api_key, key);
    const encApiSecret = encryptData(api_secret, key);
    const encUsername = encryptData(username, key);
    const encPassword = encryptData(password, key);

    const exists = await query(
      `SELECT user_id FROM user_credentials WHERE user_id=$1 AND broker_name=$2`,
      [userId, BROKER]
    );

    if (exists.rows.length) {
      await query(
        `UPDATE user_credentials
         SET icici_api_key=$1, icici_api_secret=$2,
             icici_username=$3, icici_password=$4,
             updated_at=NOW()
         WHERE user_id=$5 AND broker_name=$6`,
        [
          JSON.stringify(encApiKey),
          JSON.stringify(encApiSecret),
          JSON.stringify(encUsername),
          JSON.stringify(encPassword),
          userId,
          BROKER,
        ]
      );
    } else {
      await query(
        `INSERT INTO user_credentials
         (user_id, broker_name,
          icici_api_key, icici_api_secret,
          icici_username, icici_password)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          BROKER,
          JSON.stringify(encApiKey),
          JSON.stringify(encApiSecret),
          JSON.stringify(encUsername),
          JSON.stringify(encPassword),
        ]
      );
    }

    return res.json({
      success: true,
      message: "ICICI credentials saved securely",
    });
  } catch (err) {
    next(err);
  }
});

/* ============================================================
   RETRIEVE CREDENTIALS
============================================================ */
router.post("/retrieve", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `SELECT icici_api_key, icici_api_secret,
              icici_username, icici_password
       FROM user_credentials
       WHERE user_id=$1 AND broker_name=$2`,
      [userId, BROKER]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "No ICICI credentials found" });
    }

    const row = result.rows[0];
    const key = getEncryptionKey();

    const apiKey = decryptData(
      JSON.parse(row.icici_api_key).encrypted,
      JSON.parse(row.icici_api_key).iv,
      key
    );

    const apiSecret = decryptData(
      JSON.parse(row.icici_api_secret).encrypted,
      JSON.parse(row.icici_api_secret).iv,
      key
    );

    const username = decryptData(
      JSON.parse(row.icici_username).encrypted,
      JSON.parse(row.icici_username).iv,
      key
    );

    const password = decryptData(
      JSON.parse(row.icici_password).encrypted,
      JSON.parse(row.icici_password).iv,
      key
    );

    return res.json({
      api_key: apiKey,
      api_secret: apiSecret,
      username,
      password,
    });
  } catch (err) {
    next(err);
  }
});

/* ============================================================
   CONNECT → PERFORM BREEZE LOGIN (JWT)
============================================================ */
router.post("/connect", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const { session_token } = req.body;

    if (!session_token) {
      return res.status(400).json({
        success: false,
        error: "session_token is required (from OTP login flow)",
      });
    }

    //-------------------------------------------------------
    // 1) Load API Key + Secret from encrypted DB
    //-------------------------------------------------------
    const result = await query(
      `SELECT icici_api_key, icici_api_secret
       FROM user_credentials
       WHERE user_id=$1 AND broker_name=$2`,
      [userId, BROKER]
    );

    if (!result.rows.length) {
      return res
        .status(404)
        .json({ error: "API key/secret not stored. Please save credentials first." });
    }

    const key = getEncryptionKey();

    const apiKey = decryptData(
      JSON.parse(result.rows[0].icici_api_key).encrypted,
      JSON.parse(result.rows[0].icici_api_key).iv,
      key
    );

    const apiSecret = decryptData(
      JSON.parse(result.rows[0].icici_api_secret).encrypted,
      JSON.parse(result.rows[0].icici_api_secret).iv,
      key
    );

    //-------------------------------------------------------
    // 2) Do Breeze Login → returns JWT
    //-------------------------------------------------------
    const jwtToken = await createBreezeLoginSession(
      userId,
      apiKey,
      apiSecret,
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
