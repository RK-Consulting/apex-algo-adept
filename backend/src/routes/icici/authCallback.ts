// backend/src/routes/icici/authCallback.ts
import { Router } from "express";
import debug from "debug";
import { authenticateJWT } from "../../middleware/auth.js"; // your JWT middleware
import { iciciLimiter } from "../../middleware/rateLimiter.js"; // optional but recommended
import { breezeRequest, getCustomerDetails } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js"; // adjust if name differs

const router = Router();
const log = debug("alphaforge:icici:callback");

// STEP 1: ICICI GET redirect (no auth)
router.get("/api/icici/auth/callback", async (req, res) => {
  const { apisession } = req.query;

  if (!apisession || typeof apisession !== "string") {
    return res.redirect(`${process.env.FRONTEND_URL}/broker?icici=error&msg=no_session`);
  }

  log("Received apisession");

  return res.redirect(`${process.env.FRONTEND_URL}/icici-callback?apisession=${apisession}`);
});

// STEP 2: Complete auth (POST from frontend)
router.post(
  "/api/icici/auth/complete",
  iciciLimiter, // rate limit brute force
  authenticateJWT,
  async (req: any, res) => {
    const { apisession } = req.body;
    const userId = req.user.userId;

    if (!apisession) {
      return res.status(400).json({ error: "apisession required" });
    }

    try {
      // Use breezeClient's special CustomerDetails wrapper
      const cdData = await getCustomerDetails(userId, apisession, ""); // apiKey fetched internally via session

      const sessionToken = cdData?.Success?.session_token;
      if (!sessionToken) {
        throw new Error("Failed to retrieve session_token from CustomerDetails");
      }

      // Store/update session (your SessionService handles this)
      await SessionService.getInstance().storeSession(userId, { session_token: sessionToken });

      log("ICICI connection successful for user %s", userId);

      return res.json({ success: true, message: "ICICI Breeze connected!" });
    } catch (error: any) {
      log("Auth complete error:", error.message);
      return res.status(500).json({ error: error.message || "ICICI connection failed" });
    }
  }
);

export default router;
