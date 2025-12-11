// backend/src/routes/icici/authCallback.ts

import { Router } from "express";
import axios from "axios";
import debug from "debug";
import { authenticateJWT } from "../../middleware/auth.js"; // your existing JWT middleware
import { pool } from "../../config/database.js";
import { iciciLimiter } from "../../middleware/rateLimiter.js"; // the one we just made

const router = Router();
const log = debug("alphaforge:icici:callback");

// STEP 1: ICICI redirects here → GET request, NO JWT, NO auth headers!
router.get("/api/icici/auth/callback", async (req, res) => {
  const { apisession } = req.query;

  if (!apisession || typeof apisession !== "string") {
    return res.redirect(`${process.env.FRONTEND_URL}/broker-connect?icici=error&msg=no_session`);
  }

  log("ICICI callback received apisession for user");

  // Send apisession to your frontend callback page
  return res.redirect(`${process.env.FRONTEND_URL}/icici-callback?apisession=${apisession}`);
});

// STEP 2: Frontend calls this endpoint with the apisession + user's JWT
router.post(
  "/api/icici/auth/complete",
  iciciLimiter,          // ← RATE LIMITING HERE (5 attempts / 15 min)
  authenticateJWT,       // ← Your existing JWT check
  async (req: any, res) => {
    const { apisession } = req.body;
    const userId = req.user.userId;

    if (!apisession) {
      return res.status(400).json({ error: "apisession is required" });
    }

    try {
      // 1. Get user's own API Key & Secret from DB (per-user!)
      const { rows } = await pool.query(
        `SELECT api_key, api_secret FROM icici_credentials WHERE user_id = $1`,
        [userId]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: "ICICI credentials not found for this user" });
      }

      const { api_key, api_secret } = rows[0];

      // 2. CustomerDetails call — CORRECT WAY (data in body, not params)
      const cdResponse = await axios.get(
        "https://api.icicidirect.com/breezeapi/api/v1/customerdetails",
        {
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify({
            SessionToken: apisession,
            AppKey: api_key,
          }),
          timeout: 15000,
        }
      );

      const sessionToken = cdResponse.data?.Success?.session_token;
      if (!sessionToken) {
        throw new Error("Failed to extract session_token from CustomerDetails");
      }

      // 3. Save encrypted session token (or use it directly with BreezeConnect SDK)
      // Example table: icici_sessions(user_id, session_token_encrypted)
      // Adjust column name as per your actual schema
      await pool.query(
        `INSERT INTO icici_sessions (user_id, session_token) 
         VALUES ($1, pgp_sym_encrypt($2, $3))
         ON CONFLICT (user_id) DO UPDATE SET session_token = pgp_sym_encrypt($2, $3)`,
        [userId, sessionToken, process.env.DB_ENCRYPTION_KEY || "fallback-key"]
      );

      log("ICICI Breeze successfully connected for user:", userId);

      return res.json({
        success: true,
        message: "ICICI account connected successfully!",
      });
    } catch (error: any) {
      log("ICICI complete auth failed:", error.response?.data || error.message);

      if (error.response?.status === 403) {
        return res.status(403).json({
          error: "Forbidden (403) – Check: 1) API Key/Secret 2) Server IP whitelisted in ICICI portal",
        });
      }

      return res.status(500).json({
        error: error.message || "ICICI connection failed",
      });
    }
  }
);

export default router;
