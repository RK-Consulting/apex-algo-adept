// backend/src/routes/icici/me.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
//import { getBreezeInstance } from "../../utils/breezeSession.js";
import breezeSession from "../../utils/breezeSession.js";
import debug from "debug";

const router = Router();
const log = debug("apex:icici:me");
const { getBreezeInstance } = breezeSession;

/**
 * GET /api/icici/me
 * Validates Breeze session & checks API connectivity.
 */
router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Fetch Breeze instance (handles token reuse or regeneration)
    const breeze = await getBreezeInstance(userId);

    // Use a lightweight endpoint; ensures session is valid
    const funds = await breeze.getFunds();

    log("ICICI ME Check OK:", funds);

    return res.json({
      success: true,
      connected: true,
      data: funds,
    });
  } catch (err: any) {
    log("ICICI ME ERROR:", err);

    const message = err?.message || "Failed to validate ICICI connection";

    // Categorized error responses
    if (
      message.includes("Invalid session") ||
      message.includes("session expired") ||
      message.includes("Unauthenticated")
    ) {
      return res.status(401).json({
        success: false,
        connected: false,
        error: "ICICI session expired — reconnect required.",
      });
    }

    if (
      message.includes("API key") ||
      message.includes("secret") ||
      message.includes("token generation failed")
    ) {
      return res.status(400).json({
        success: false,
        connected: false,
        error: "Invalid ICICI API credentials. Please update in settings.",
      });
    }

    if (message.toLowerCase().includes("network") || message.includes("ECONN")) {
      return res.status(503).json({
        success: false,
        connected: false,
        error: "ICICI Breeze service temporarily unavailable.",
      });
    }

    return res.status(500).json({
      success: false,
      connected: false,
      error: message,
    });
  }
});

export { router as iciciMeRouter };
