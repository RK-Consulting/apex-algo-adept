// backend/src/routes/iciciAuth.ts

import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  createBreezeLoginSession,
} from "../utils/breezeSession.js";

const router = Router();

/**
 * 1) Redirect user to ICICI Login Page
 */
router.get("/auth/login", authenticateToken, async (req, res) => {
  const apiKey = req.query.api_key || req.user?.icici_api_key;

  if (!apiKey) {
    return res.status(400).send("Missing API Key");
  }

  const loginUrl =
    `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(String(apiKey))}`;

  return res.redirect(loginUrl);
});

/**
 * 2) Receive callback FROM ICICI (POST)
 */
router.post("/auth/callback", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { apisession, api_key, api_secret } = req.body;

    if (!apisession || !api_key || !api_secret) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const session = await createBreezeLoginSession(
      userId,
      api_key,
      api_secret,
      apisession
    );

    return res.json({
      success: true,
      session_token: session.jwtToken,
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const iciciAuthRouter = router;
export default router;
