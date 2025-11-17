
// apex-algo-adept/backend/src/routes/icici/me.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import debug from "debug";

const log = debug("apex:icici:me");
const router = Router();

/**
 * GET /api/icici/me
 * Breeze session heartbeat
 */
router.get("/me", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const breeze = await getBreezeInstance(userId);

    // Primary call supported in Breeze API (works reliably)
    const response = await breeze.getCustomerDetails();

    return res.json({
      success: true,
      session: "ACTIVE",
      details: response,
    });
  } catch (err: any) {
    log("❌ /api/icici/me:", err);

    return res.status(401).json({
      success: false,
      session: "INVALID",
      error: err?.message ?? "ICICI session invalid",
    });
  }
});

export { router as iciciMeRouter };
