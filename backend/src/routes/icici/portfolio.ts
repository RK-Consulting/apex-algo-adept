// src/routes/icici/portfolio.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import debug from "debug";

const router = Router();
const log = debug("apex:icici:portfolio");

/**
 * GET /api/icici/portfolio/holdings
 * Fetch live portfolio holdings
 */
router.get("/holdings", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const breeze = await getBreezeInstance(userId);

    // Breeze v2+ uses `getPortfolioHoldings(exchangeCode)`
    const holdings = await breeze.getPortfolioHoldings("NSE");

    return res.json({
      success: true,
      holdings,
    });
  } catch (err: any) {
    log("Failed to fetch holdings:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch holdings",
      details: err?.message || err,
    });
  }
});

/**
 * GET /api/icici/portfolio/positions
 * Fetch F&O / intraday positions
 */
router.get("/positions", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const breeze = await getBreezeInstance(userId);

    // Breeze v2+ uses getPortfolioPositions()
    const positions = await breeze.getPortfolioPositions();

    return res.json({
      success: true,
      positions,
    });
  } catch (err: any) {
    log("Failed to fetch positions:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch positions",
      details: err?.message || err,
    });
  }
});

export { router as portfolioRouter };
