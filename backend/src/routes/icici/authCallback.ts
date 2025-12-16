// backend/src/routes/icici/authCallback.ts
import { Router } from "express";
import debug from "debug";
import { AuthRequest } from '../../middleware/auth.js';
import { authenticateJWT } from "../../middleware/auth.js"; // your JWT middleware
import { iciciLimiter } from "../../middleware/rateLimiter.js"; // optional but recommended
import { breezeRequest, getCustomerDetails } from "../../services/breezeClient.js";
import { SessionService } from "../../services/sessionService.js"; // adjust if name differs
import { authenticateToken } from '../../middleware/auth.js';  // Correct name

const router = Router();
const log = debug("alphaforge:icici:callback");

// STEP 1: ICICI GET redirect (no auth)
//router.get("/api/icici/auth/callback", async (req, res) => {
  // ICICI Breeze OAuth Callback - Saves session post-auth
router.get('/api/icici/auth/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { session_token: sessionToken, apisession, customer_details: customerDetails } = req.query;
    if (!sessionToken || typeof sessionToken !== 'string') {
      return res.status(400).json({ error: 'Invalid session token from ICICI' });
    }

    const userId = req.user!.userId;
    await SessionService.getInstance().saveSession(userId, {  // saveSession, not storeSession
      session_token: sessionToken as string,
      apisession: apisession as string,
      user_details: customerDetails,  // JSON from Breeze
    });

    // Redirect to frontend dashboard with success
    const redirectUrl = `${process.env.FRONTEND_URL || 'https://alphaforge.skillsifter.in'}/dashboard?connected=true`;
    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('[ICICI Callback] Error:', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
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
