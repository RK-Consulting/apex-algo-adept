// backend/src/routes/icici/me.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import debug from "debug";

const router = Router();
const log = debug("apex:icici:me");

/**
 * GET /api/icici/me
 * Validate Breeze session
 */
router.get("/me", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;  // ✅ FIXED

    const breeze = await getBreezeInstance(userId);

    // Safe check to validate session
    const response = await breeze.getFunds();

    log("ICICI ME Check:", response);

    return res.json({
      success: true,
      connected: true,
      data: response,
    });
  } catch (err: any) {
    log("ICICI ME Error:", err);

    return res.status(500).json({
      success: false,
      connected: false,
      error: err.message || "Failed to validate ICICI connection",
    });
  }
});

export { router as iciciMeRouter };
