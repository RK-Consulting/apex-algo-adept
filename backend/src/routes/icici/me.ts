
// apex-algo-adept/backend/src/routes/icici/me.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import debug from "debug";

const log = debug("apex:icici:me");
const router = Router();

/**
 * GET /api/icici/me
 * Validates Breeze session by calling a guaranteed-supported API
 */
router.get("/me", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const breeze = await getBreezeInstance(userId);

    // Validate session using a safe supported method
    const testResponse = await breeze.getPortfolioHoldings({});

    return res.json({
      success: true,
      session: "ACTIVE",
      response: testResponse,
    });

  } catch (err: any) {
    log("❌ /api/icici/me Error:", err);
    return res.status(401).json({
      success: false,
      session: "INVALID",
      error: err?.message ?? "ICICI session invalid",
    });
  }
});

export { router as iciciMeRouter };

