// src/routes/icici/portfolio.ts
import { Router } from "express";
import { authenticateToken, AuthRequest } from "../../middleware/auth.js";
import { getBreezeInstance } from "../../utils/breezeSession.js";
import debug from "debug";

const router = Router();
const log = debug("apex:icici:portfolio");

/**
 * GET /api/icici/portfolio/holdings
 */
router.get("/holdings", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);

    // Breeze API
    const holdings = await breeze.getPortfolioHoldings();

    return res.json({
      success: true,
      holdings: holdings || [],
    });
  } catch (err: any) {
    log("Holdings error:", err);
    return res.status(500).json({
      error: "Failed to fetch holdings",
      details: err?.message || err,
    });
  }
});

/**
 * GET /api/icici/portfolio/positions
 */
router.get("/positions", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);

    const positions = await breeze.getPortfolioPositions();

    return res.json({
      success: true,
      positions: positions || [],
    });
  } catch (err: any) {
    log("Positions error:", err);
    return res.status(500).json({
      error: "Failed to fetch positions",
      details: err?.message || err,
    });
  }
});

/**
 * GET /api/icici/portfolio/funds
 */
router.get("/funds", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);

    const funds = await breeze.getFunds();

    return res.json({
      success: true,
      funds: funds || {},
    });
  } catch (err: any) {
    log("Funds error:", err);
    return res.status(500).json({
      error: "Failed to fetch funds",
      details: err?.message || err,
    });
  }
});

/**
 * GET /api/icici/portfolio/summary
 * Dashboard endpoint — holdings + positions + funds
 */
router.get("/summary", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const breeze = await getBreezeInstance(req.user!.id);

    const [holdings, positions, funds] = await Promise.all([
      breeze.getPortfolioHoldings(),
      breeze.getPortfolioPositions(),
      breeze.getFunds(),
    ]);

    return res.json({
      success: true,
      holdings: holdings || [],
      positions: positions || [],
      funds: funds || {},
    });
  } catch (err: any) {
    log("Summary error:", err);
    return res.status(500).json({
      error: "Failed to fetch portfolio summary",
      details: err?.message || err,
    });
  }
});

export { router as iciciPortfolioRouter };
