// src/routes/icici/authCallback.ts
import { Router } from "express";
import axios from "axios";
import debug from "debug";
import { authenticateJWT } from "../../middleware/auth.js";
import { pool } from "../../config/database.js";
import { encryptJSON, decryptJSON } from "../../utils/credentialEncryptor.js";

const log = debug("apex:icici:callback");
const router = Router();

// STEP 1: ICICI redirects here with GET + ?apisession=xxx (NO AUTH HEADERS!)
router.get("/api/icici/auth/callback", async (req, res) => {
  try {
    const { apisession } = req.query;
    if (!apisession || typeof apisession !== "string") {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?icici=error&msg=no_session`);
    }

    log("Received apisession: %s", apisession);

    // Forward to frontend callback page
    return res.redirect(`${process.env.FRONTEND_URL}/icici-callback?apisession=${apisession}`);
  } catch (error: any) {
    log("GET callback error:", error);
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?icici=error`);
  }
});

// STEP 2: Frontend sends apisession here to complete login
router.post("/api/icici/auth/complete", authenticateJWT, async (req: any, res) => {
  const { apisession } = req.body;
  const userId = req.user.userId;

  if (!apisession) {
    return res.status(400).json({ error: "API session required" });
  }

  try {
    // Get user's stored (encrypted) credentials
    const { rows } = await pool.query(
      `SELECT api_key, api_secret FROM icici_credentials WHERE user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "No ICICI credentials found" });
    }

    const { api_key, api_secret } = rows[0];

    // CRITICAL FIX: CustomerDetails expects body, not query params
    const cdResponse = await axios.get(
      "https://api.icicidirect.com/breezeapi/api/v1/customerdetails",
      {
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          SessionToken: apisession,
          AppKey: api_key,
        }),
        timeout: 10000,
      }
    );

    const sessionToken = cdResponse.data?.Success?.session_token;
    if (!sessionToken) {
      throw new Error("Failed to get session_token from CustomerDetails");
    }

    // Store encrypted session token
    const encryptedToken = encryptJSON({ sessionToken });

    await pool.query(
      `INSERT INTO icici_sessions (user_id, session_token, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET session_token = $2`,
      [userId, encryptedToken]
    );

    log("ICICI login completed for user:", userId);

    return res.json({
      success: true,
      message: "ICICI connected successfully",
    });
  } catch (error: any) {
    log("Complete auth error:", error.response?.data || error.message);

    if (error.response?.status === 403) {
      return res.status(403).json({
        error: "Forbidden - Check your API credentials and server IP whitelist",
      });
    }

    return res.status(500).json({
      error: error.message || "Login failed",
    });
  }
});

export default router;
