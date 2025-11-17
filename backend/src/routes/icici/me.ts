import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import debug from "debug";

const log = debug("apex:icici:me");
const router = Router();

/**
 * GET /api/icici/me
 * Returns Breeze session status and profile if valid
 */
router.get("/me", authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const breeze = await getBreezeInstance(userId);

    // Breeze has a simple call to check profile/session
    const response = await breeze.getProfile();

    return res.json({
      success: true,
      session: "ACTIVE",
      profile: response
    });

  } catch (err: any) {
    log("Error in /me:", err);

    return res.status(401).json({
      success: false,
      session: "INVALID",
      error: err?.message ?? "ICICI session invalid",
    });
  }
});

export { router as iciciMeRouter };
