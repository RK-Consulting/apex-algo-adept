// backend/src/routes/iciciAuth.ts

import { Router } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { createBreezeLoginSession } from "../utils/breezeSession.js";

const router = Router();

router.get("/auth/login", authenticateToken, async (req: AuthRequest, res) => {
  const apiKey = req.query.api_key;
  if (!apiKey) return res.status(400).send("Missing API key");

  const url = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(
    String(apiKey)
  )}`;

  return res.redirect(url);
});

router.post("/auth/callback", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { apisession, api_key, api_secret } = req.body;

    if (!apisession || !api_key || !api_secret)
      return res.status(400).json({ error: "Missing callback parameters" });

    const session = await createBreezeLoginSession(userId, api_key, api_secret, apisession);

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
